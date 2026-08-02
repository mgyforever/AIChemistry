# © 2024 National Technology & Engineering Solutions of Sandia, LLC (NTESS).  Under the terms of Contract DE-NA0003525 with NTESS, the U.S. Government retains certain rights in this software.
# SPDX-License-Identifier: BSD-3-Clause

import pubchempy as pcp
from flask import Blueprint, jsonify, Response, current_app, stream_with_context, request
import queue
from rdkit import Chem
from rdkit.Chem import Draw
from rdkit.Chem.Draw import SimilarityMaps
from rdkit.Chem.Draw import rdMolDraw2D
import io
import base64
import json
import time
import logging
import matplotlib
matplotlib.use('Agg')  # Force headless backend for server
from Comparison.utils.gen import parseQuery as pq
from utils.progress_logger import ProgressLogger

# Define Blueprint and logger at the very top, before any route decorators
api_bp = Blueprint("api", __name__)
logger = logging.getLogger(__name__)

def get_progress_queue(job_id):
    """Get the progress queue from the ProgressLogger system."""
    job_id_str = str(job_id)
    
    # Use the ProgressLogger's queue storage system instead of a separate one
    with ProgressLogger._lock:
        if job_id_str in ProgressLogger._progress_queues:
            logger.debug(f"Found existing queue for job {job_id_str}")
            return ProgressLogger._progress_queues[job_id_str]
        else:
            # Create a new queue and store it in ProgressLogger's system
            import queue
            new_queue = queue.Queue()
            ProgressLogger._progress_queues[job_id_str] = new_queue
            logger.debug(f"Created new queue for job {job_id_str}")
            return new_queue

@api_bp.route("/api/search_similar", methods=["POST"])
def api_search_similar():
    """
    REST API endpoint for programmatic compound similarity search.
    Accepts JSON input, calls SingleRun, and returns results as JSON.

    JSON Body:
    {
        "query": "6517" | "quinolin-8-ol" | "C1=CC=C2C(=C1)C=CC=N2",
        "final_number": 30,
        "thermo_properties": ["MeltingPoint", "BoilingPoint"],
        "include_all_elements": false,
        "include_specific_elements": ["Si"],
        "disallow_isotopes": false,
        "substructure_smarts": null,
        "substructure_count": null,
        "weights": [1, 1, 1, 1, 1]
    }

    Returns:
    {
        "status": "success" | "error",
        "message": "...",
        "query": { "input": "...", "smiles": "...", "name": "...", "cid": -1 },
        "results": [
            {
                "cid": "6517",
                "final_score": 0.85,
                "structural_similarity": 0.9,
                "mw_similarity": 0.8,
                "thermo_similarity": 0.7,
                "toxicity": 0.6,
                "sa_score": 0.5,
                "properties": { "MP_pred": "123.4", "BP_pred": "456.7" }
            },
            ...
        ],
        "meta": {
            "total_results": 30,
            "substructure_search_relaxed": false,
            "opera_failed": false
        }
    }
    """
    import json
    import traceback as tb_module
    
    logger = logging.getLogger(__name__)
    logger.info("api_search_similar called")

    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Invalid JSON: {e}"}), 400

    if not data or "query" not in data:
        return jsonify({"status": "error", "message": "Missing required field: query"}), 400

    query = data["query"]
    final_number = data.get("final_number", 30)
    include_all_elements = data.get("include_all_elements", False)
    include_specific_elements = data.get("include_specific_elements", [])
    disallow_isotopes = data.get("disallow_isotopes", False)
    substructure_smarts = data.get("substructure_smarts", None)
    substructure_count = data.get("substructure_count", None)
    weights = data.get("weights", [1, 1, 1, 1, 1])

    # Parse thermo_properties list to tarray (5 booleans)
    thermo_properties = data.get("thermo_properties", [])
    prop_map = {
        "MeltingPoint": 0,
        "BoilingPoint": 1,
        "LogP": 2,
        "HenrysLaw": 3,
        "VaporPressure": 4,
    }
    tarray = [False, False, False, False, False]
    for prop in thermo_properties:
        idx = prop_map.get(prop)
        if idx is not None:
            tarray[idx] = True

    # Build incEle parameter
    if include_all_elements:
        incEle = True
    elif include_specific_elements:
        incEle = include_specific_elements
    else:
        incEle = [""]

    # Generate job_id
    import uuid
    job_id = f"api_{uuid.uuid4().hex}"

    logger.info(f"api_search_similar: query={query}, finnum={final_number}, tarray={tarray}, incEle={incEle}")

    try:
        from Comparison.Controller import SingleRun
        import queue

        progress_queue = queue.Queue()
        containers = []

        results_data = SingleRun(
            query, final_number, tarray, incEle,
            substructure_smarts, substructure_count,
            weights, containers, job_id, progress_queue, disallow_isotopes
        )

        if results_data is None:
            return jsonify({
                "status": "error",
                "message": "Search failed - see CRS logs for details",
                "query": {"input": query},
                "results": [],
                "meta": {"total_results": 0}
            }), 500

        # Unpack results
        if len(results_data) == 4:
            final_results, query_models, subfailed, opera_failed = results_data
        else:
            return jsonify({
                "status": "error",
                "message": "Unexpected results format from SingleRun",
                "query": {"input": query},
                "results": [],
                "meta": {"total_results": 0}
            }), 500

        # Resolve query info
        query_cid = -1
        query_smiles = ""
        query_name = ""
        try:
            from Comparison.utils.gen import parseQuery as pq
            parsed = pq(query)
            if parsed and len(parsed) >= 4:
                query_cid = parsed[1] if parsed[1] is not None else -1
                query_name = parsed[2] if parsed[2] is not None else ""
                query_smiles = parsed[3] if parsed[3] is not None else ""
        except Exception:
            pass

        # Build checkstring from tarray
        from Comparison.utils.post import createCheckstring as cc
        checkstring = cc(tarray)

        # Format results into clean JSON
        formatted_results = []
        for row in final_results:
            if not row or len(row) < 7:
                continue

            result_obj = {
                "cid": str(row[0]) if row[0] is not None else "",
                "final_score": float(row[1]) if row[1] is not None else 0,
                "structural_similarity": float(row[2]) if row[2] is not None else 0,
                "mw_similarity": float(row[3]) if row[3] is not None else 0,
                "thermo_similarity": float(row[4]) if row[4] is not None else 0,
                "toxicity": float(row[5]) if row[5] is not None else 0,
                "sa_score": float(row[6]) if row[6] is not None else 0,
                "properties": {}
            }

            # Add OPERA predicted properties
            for i, col in enumerate(checkstring):
                col_idx = 7 + i
                if len(row) > col_idx and row[col_idx] is not None:
                    result_obj["properties"][col] = str(row[col_idx])

            formatted_results.append(result_obj)

        response = {
            "status": "success",
            "message": f"Found {len(formatted_results)} similar compounds",
            "query": {
                "input": query,
                "smiles": query_smiles,
                "name": query_name,
                "cid": query_cid,
            },
            "results": formatted_results,
            "meta": {
                "total_results": len(formatted_results),
                "substructure_search_relaxed": bool(subfailed) if subfailed else False,
                "opera_failed": bool(opera_failed) if opera_failed else False,
            }
        }

        logger.info(f"api_search_similar completed: {len(formatted_results)} results")
        return jsonify(response)

    except Exception as e:
        tb = tb_module.format_exc()
        logger.error(f"api_search_similar error: {e}\n{tb}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "query": {"input": query},
            "results": [],
            "meta": {"total_results": 0}
        }), 500


@api_bp.route("/api/similarity_map")
def similarity_map():
    """
    Returns a similarity map image (PNG) comparing the given CID to the query molecule (reference).
    Query molecule is taken from current_app.state.queryval.
    Target molecule is given by ?cid=...
    """
    state = current_app.state
    queryval = getattr(state, "queryval", None)
    target_cid = request.args.get("cid", None)
    if not queryval or not target_cid:
        return jsonify({"error": "Missing query or cid"}), 400

    # Get SMILES for query and target
    import traceback
    try:
        # Query molecule
        from Comparison.utils.gen import get_compound_properties
        if queryval.isdigit():
            query_smiles, _ = get_compound_properties(int(queryval))
        else:
            # Try to resolve as name or SMILES
            try:
                query_cid = pcp.get_cids(queryval, "name", list_return="flat")[0]
                query_smiles, _ = get_compound_properties(query_cid)
            except Exception as e:
                logger.error(f"Could not resolve queryval '{queryval}' as name: {e}")
                query_smiles = queryval

        # Target molecule
        try:
            target_smiles, _ = get_compound_properties(int(target_cid))
        except Exception as e:
            logger.error(f"Could not resolve target_cid '{target_cid}': {e}")
            return jsonify({"error": f"Could not resolve target_cid '{target_cid}': {e}"}), 400

        logger.info(f"Query SMILES: {query_smiles}, Target SMILES: {target_smiles}")
        refmol = Chem.MolFromSmiles(query_smiles)
        mol = Chem.MolFromSmiles(target_smiles)
        if not refmol or not mol:
            logger.error(f"Could not parse molecules: query_smiles={query_smiles}, target_smiles={target_smiles}")
            return jsonify({"error": f"Could not parse molecules: query_smiles={query_smiles}, target_smiles={target_smiles}"}), 400

        # Create a 2D drawing object
        d2d = Draw.MolDraw2DCairo(300, 300)

        # Generate the similarity map
        try:
            _, maxweight = SimilarityMaps.GetSimilarityMapForFingerprint(
                refmol, mol,
                fpFunction = lambda m, i: SimilarityMaps.GetMorganFingerprint(m, i, radius=2, fpType='bv'),
                draw2d=d2d,
            )
            d2d.FinishDrawing()
        except Exception as e:
            logger.error(f"Error in GetSimilarityMapForFingerprint: {e}")
            # fallback: draw plain molecule
            d2d.DrawMolecule(mol)
            d2d.FinishDrawing()
        img_bytes = d2d.GetDrawingText()

        # Return as base64 data URL for easy frontend use
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        return jsonify({"image": "data:image/png;base64," + img_b64})
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error generating similarity map: {e}\n{tb}")
        return jsonify({"error": str(e), "traceback": tb}), 500
    
@api_bp.route("/progress_stream")
def progress_stream():
    job_id = str(request.args.get("job_id", "default"))
    logger.info(f"Progress stream requested for job_id: {job_id}")
    
    # Make sure the queue exists
    q = get_progress_queue(job_id)

    def event_stream():
        # Set connection timeout longer
        timeout = 30
        last_ping = time.time()
        ping_interval = 5  # Send a ping every 5 seconds
        
        try:
            # Start streaming progress messages
            while True:
                try:
                    # Check if we need to send a keep-alive ping
                    current_time = time.time()
                    if current_time - last_ping > ping_interval:
                        yield ": ping\n\n"
                        last_ping = current_time
                    
                    # Try to get a message with a shorter timeout to allow for pings
                    try:
                        message = q.get(block=True, timeout=1)
                        logger.debug(f"Sending progress update for job {job_id}: {message}")
                        yield f"data: {message}\n\n"
                    except queue.Empty:
                        # No message yet, just continue the loop for pings
                        continue
                    
                except Exception as e:
                    # Log any errors but try to continue
                    logger.error(f"Error in event stream loop for {job_id}: {str(e)}")
                    yield f"data: {json.dumps({'status': 'Warning', 'detail': f'Stream error: {str(e)}'})}\n\n"
                    time.sleep(1)  # Prevent tight loop if there's an error
        
        except GeneratorExit:
            # Client disconnected
            logger.info(f"Client disconnected from SSE stream for job {job_id}")
        except Exception as e:
            logger.error(f"Fatal error in event stream for job {job_id}: {str(e)}")
            yield f"data: {json.dumps({'status': 'Error', 'detail': f'Stream terminated: {str(e)}'})}\n\n"

    # Set response headers for SSE
    response = Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream"
    )
    # Add additional headers to prevent buffering
    response.headers['Cache-Control'] = 'no-cache, no-transform'
    response.headers['X-Accel-Buffering'] = 'no'  # For Nginx
    return response

@api_bp.route("/api/query_image")
def query_image():
    print("started")
    state = current_app.state
    query_smiles = state.queryval

    mol = Chem.MolFromSmiles(query_smiles)

    img_width = 300
    img_height = 300
    drawer = rdMolDraw2D.MolDraw2DCairo(img_width, img_height)
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    img_bytes = drawer.GetDrawingText()

    # Encode image bytes as base64 for JSON transport
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    print("returning")
    return jsonify({"image": "data:image/png;base64," + img_b64})