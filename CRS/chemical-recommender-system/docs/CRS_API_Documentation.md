# CRS (Chemical Recommender System) 接口文档

## 1. 概述

CRS 是一个化学化合物推荐系统，通过多维度的相似性分析，为用户输入的查询分子（支持 PubChem CID、IUPAC 名称或 SMILES）推荐结构相似、性质相近的候选化合物。系统通过 **分子指纹相似度**、**热物理性质**、**毒性评估**、**结构属性** 和 **合成可及性** 五个维度对候选化合物进行综合排序。

### 核心流程

```
用户输入查询 → PubChem解析(CID/SMILES) → Milvus向量搜索(分子指纹相似度)
  → 候选过滤(元素/同位素/子结构) → OPERA属性预测 → 多维度打分
  → 归一化 → 加权综合排序 → 生成报告(CSV/PDF)
```

---

## 2. 调用方式

### 2.1 核心入口：`SingleRun`

位于 `src/Comparison/Controller.py`，是单次搜索的主入口函数。

```python
def SingleRun(
    queryinput,      # 查询输入
    finnum,          # 结果数量
    tarray,          # 热物理属性选择
    incEle,          # 元素过滤
    smarts,          # 子结构SMARTS
    smarts_num,      # 子结构匹配数量
    weights,         # 权重数组
    containers,      # 自定义模型容器
    job_id="default",# 任务ID
    progress_queue=None,  # 进度队列(SSE)
    disallow_isotopes=False  # 禁止同位素
)
```

**返回值**：`(final_results, query_models, subfailed, opera_failed)`，失败时返回 `None`。

### 2.2 批量入口：`BatchRun`

位于 `src/Comparison/Controller.py`，支持多查询批量处理。

```python
def BatchRun(
    batch_text,      # 批量输入文本
    output=None,     # 输出文件路径
    from_command=False,  # 是否来自命令行
    containers=[],   # 自定义模型容器
    job_id="default",# 任务ID
    progress_queue=None   # 进度队列
)
```

### 2.3 Web API 入口

CRS 同时提供 Flask Web 服务（默认端口 5005）：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/search` | GET/POST | 单次搜索页，POST 提交执行搜索 |
| `/search_status` | GET | SSE 轮询搜索状态和结果 |
| `/progress_stream` | GET | 实时进度流 (Server-Sent Events) |
| `/batch` | GET/POST | 批量搜索页 |
| `/results` | GET | 查看搜索结果页 |

---

## 3. 参数详细说明

### 3.1 `queryinput` — 查询输入

**类型**：`str`

**支持格式**：

| 格式 | 示例 | 说明 |
|------|------|------|
| PubChem CID | `"6517"` | 数字字符串 |
| IUPAC 名称 | `"quinolin-8-ol"` | 标准化学名称 |
| SMILES | `"C1=CC=C2C(=C1)C=CC=N2"` | 分子 SMILES 表示 |
| PubChem 未知的 SMILES | `"CCCCCCCCC2C..."` | 不在 PubChem 中的自定义分子 |

**内部解析逻辑**（`parseQuery` in `src/Comparison/utils/gen.py`）：
1. 先尝试按 CID 解析 → 从 PubChem 获取 SMILES
2. 再尝试按 IUPAC 名称解析 → 从 PubChem 获取 CID 和 SMILES
3. 最后尝试按 SMILES 解析 → 从 PubChem 查找对应 CID
4. 若 PubChem 中不存在，CID 设为 `-1`，使用 RDKit 直接生成分子指纹

### 3.2 `finnum` — 最终结果数量

**类型**：`int`，正整数，建议不超过 1000

**说明**：输出的最终候选化合物数量。内部流程中：
- 首先从 Milvus 检索 `finnum × 3 × 20`（约 60 倍）的候选分子指纹
- 经过元素/子结构/同位素过滤后保留合格候选
- 经过多维打分和排序后返回前 `finnum` 个结果

### 3.3 `tarray` — 热物理属性选择

**类型**：`list[bool]`，长度为 5

**顺序**：

| 索引 | 属性 | 英文名 | OPERA 预测列名 |
|------|------|--------|----------------|
| 0 | 熔点 | Melting Point | `MP_pred` |
| 1 | 沸点 | Boiling Point | `BP_pred` |
| 2 | 油水分配系数 | Log P | `LogP_pred` |
| 3 | 亨利定律常数 | Henry's Law Constant | `LogHL_pred` |
| 4 | 蒸气压 | Vapor Pressure | `LogVP_pred` |

**示例**：
```python
tarray = [True, True, False, False, True]  # 仅比较熔点、沸点、蒸气压
```

**注意**：即使热物理属性全选 `False`，系统仍会通过 OPERA 计算以下毒性/结构属性：
- `LogBCF_pred` — 生物富集系数
- `CATMoS_EPA_pred` — EPA 毒性分类
- `CATMoS_LD50_pred` — LD50 急性毒性
- `MolWeight` — 分子量
- `nbRing` — 环数
- `nbLipinskiFailures` — Lipinski 规则违反数
- `TopoPolSurfAir` — 拓扑极性表面积
- `nbC` — 碳原子数

### 3.4 `incEle` — 元素过滤

**类型**：`bool` 或 `list[str]`

| 值 | 说明 |
|-----|------|
| `True` | 允许所有元素，不做元素过滤 |
| `["Si"]` | 在默认元素之外额外允许硅 (Si) |
| `["Si", "B", "Li"]` | 允许多个額外元素 |
| `[""]` 或空列表 | 仅使用默认元素列表 |

**默认允许的元素**（共 11 种）：
`H, C, N, O, F, P, S, Cl, Se, Br, I`

**过滤逻辑**（`filterCIDs` in `src/Comparison/utils/gen.py`）：
- 当 `incEle != True` 时，候选化合物的分子式中每个元素必须在「默认列表 + incEle 指定列表」中
- 否则该候选被排除

### 3.5 `smarts` — 子结构搜索

**类型**：`str` 或 `None`

**格式**：SMARTS 模式表达式，用于在候选化合物中匹配特定子结构

**示例**：
```python
smarts = "CCO"      # 必须含有 C-C-O 子结构
smarts = "c1ccccc1" # 必须含有苯环
smarts = "[NH2]"    # 必须含有伯胺基团
smarts = None       # 不做子结构过滤
```

### 3.6 `smarts_num` — 子结构匹配数量

**类型**：`int`, `str` 或 `None`

**说明**：
- 与 `smarts` 配合使用
- 指定子结构在候选分子中必须出现的次数

| 值 | 含义 |
|-----|------|
| `1` | 恰好出现 1 次 |
| `2` | 恰好出现 2 次 |
| `3` | 恰好出现 3 次 |
| `None` | 至少出现 1 次或更多（默认） |

**注意**：若 `smarts` 为 `None`，此参数被忽略。

### 3.7 `disallow_isotopes` — 禁止同位素

**类型**：`bool`（命令行输入时使用 `0` 或 `1`）

**说明**：
- `False` (0)：允许包含同位素的候选化合物
- `True` (1)：排除与查询分子具有相同原子组成但同位素不同的候选化合物

**同位素检测逻辑**：
比较候选分子和查询分子的原子组成和同位素分布。如果化学式相同、原子序数相同、但同位素质量数不同，则判定为同位素变体并被过滤掉。

### 3.8 `weights` — 权重数组

**类型**：`list[int|float]`，非负数

**默认值**：`[1, 1, 1, 1, 1]`（需扩展为 `5 + len(containers)` 长度）

**对应维度**：

| 索引 | 维度 | 说明 |
|------|------|------|
| 0 | 结构相似性 (Structural) | 分子指纹 Tanimoto 相似度 + OPERA 结构属性 |
| 1 | 分子量相似性 (Molecular Weight) | 候选与查询的分子量差异 |
| 2 | 热物理相似性 (Thermophysical) | 由 tarray 选中的 OPERA 预测属性比较 |
| 3 | 毒性评估 (Toxicity) | BCF × EPA × LD50 综合毒性评分 |
| 4 | 合成可及性 (SA Scoring) | RDKit 预测的合成难度 (1-10) |
| 5+ | 自定义模型 | 每个自定义容器模型的权重 |

**综合评分公式**（`processDict` in `src/Comparison/utils/post.py`）：

```
final_score = (structural ^ w0) × (molecular_weight ^ w1) × (thermophysical ^ w2)
            × (SA ^ w4) / (toxicity ^ w3) × ∏(custom_model_i ^ w_{5+i})
```

**示例**：
```python
weights = [2, 1, 1, 1, 0]  # 重视结构相似性，忽略合成可及性
weights = [1, 1, 1, 1, 1]  # 默认均匀权重
```

### 3.9 `containers` — 自定义模型容器

**类型**：`list[str]`

**说明**：其他 Docker 容器名称，每个容器需提供 `/compute` 端点，接收 SMILES 列表并返回预测值。

自定义模型的 Flask API 规范（参考 `src/Model/app.py`）：

```python
# POST /compute
# Body: {"smiles": ["CCO", "c1ccccc1", ...]}
# Response: {"CCO": <float_value>, "c1ccccc1": <float_value>, ...}
```

### 3.10 `job_id` — 任务标识

**类型**：`str`

**说明**：唯一任务 ID，用于日志追踪和进度通知：
- Web 搜索：自动生成 `search_{uuid}`
- 批量搜索：自动生成 `batch_{uuid}`
- 命令行：自动生成 `cli_{uuid}`

---

## 4. 返回值结构

### 4.1 `SingleRun` 返回值

```python
(final_results, query_models, subfailed, opera_failed)
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `final_results` | `list[list]` | 排序后的结果列表，每项为一个化合物的所有评分数据 |
| `query_models` | `list` | 自定义模型的返回值 |
| `subfailed` | `bool` | 子结构过滤是否因过于严格而放宽 |
| `opera_failed` | `bool` | OPERA 属性预测是否失败 |

### 4.2 `final_results` 内部结构

每个结果条目是一个列表，顺序如下：

| 索引 | 字段名 | 说明 |
|------|--------|------|
| 0 | CID | 化合物 PubChem CID |
| 1 | Overall | 综合加权相似度得分 |
| 2 | Fingerprint | 分子指纹 Tanimoto 相似度 |
| 3 | Molecular | 分子量相似度 |
| 4 | Thermophysical | 热物理属性相似度 |
| 5 | Toxicity | 毒性评分（值越大毒性越低越相似） |
| 6 | Synthetic | 合成可及性评分 |
| 7+ | 自定义属性 | 容器模型返回值（如 MP_pred, BP_pred 等） |

### 4.3 `comp_dict` 中间数据结构

在内部处理过程中，`comparisonFunction` 返回的 `comp_dict` 结构为：

```python
{
    "<CID>": [score, structural, molecular_weight, thermal, toxic, SA_score, ...container_scores],
    ...
}
```

| 索引 | 字段 | 说明 |
|------|------|------|
| 0 | score | 初始分子指纹相似度 (Tanimoto)，后续被替换为综合得分 |
| 1 | structural | 结构相似度（指纹 + OPERA 结构属性） |
| 2 | molecular_weight | 分子量相似度 |
| 3 | thermal | 热物理相似度 |
| 4 | toxic | 毒性评分 |
| 5 | SA_score | 合成可及性评分 (1-10 映射后) |

---

## 5. 内部处理流程详解

### 阶段 1：查询解析 (`parseQuery`)
- 识别输入格式（CID/名称/SMILES）
- 通过 PubChem API 获取规范化 SMILES 和 IUPAC 名称
- 若 PubChem 中不存在，使用 RDKit 直接从 SMILES 生成 2048 位 Morgan 指纹

### 阶段 2：向量搜索 (`runMilvus`)
- 将查询分子指纹转为二进制向量
- 连接 Milvus 向量数据库（`tcp://localhost:19530`）
- 对 120 个分区（`cluster_0` ~ `cluster_119`）分批搜索
- 使用 **Jaccard 距离** 度量相似度
- 距离转换为 Tanimoto 相似度：`similarity = 1 - distance`
- 维护 top-k 堆结构，保留最佳匹配的 `heapnum` 个候选

### 阶段 3：候选过滤 (`fillDict` / `filterCIDs`)
- **去重**：排除与查询名称相同或包含查询名称的候选
- **SMILES 有效性**：排除含 `.` 的无效 SMILES
- **排除自身**：排除与查询 SMILES 完全相同的候选
- **元素过滤**：按 `incEle` 参数过滤
- **子结构过滤**：按 `smarts` / `smarts_num` 进行 SMARTS 子结构匹配
- **同位素过滤**：按 `disallow_isotopes` 排除同位素变体
- **采样策略**：分批从堆中取出候选并过滤，直到凑齐 `finsize` 个合格候选
- **同分处理**：若截止分数处有多名同分候选，全部纳入

### 阶段 4：OPERA 属性预测 (`runProperty`)
- 将所有候选 SMILES 和查询 SMILES 送入 OPERA CLI
- 计算用户选择的物理属性 + 毒性属性 + 结构属性
- 若批处理失败，逐化合物重试
- 若全部失败，返回 `opera_failed=True`，后续使用中性值

### 阶段 5：多维评分

#### 5.1 结构相似性 (`extraStrucComp`)
比较 OPERA 预测的结构属性：
- 分子量差异：`1 / (1 + |(mw_cand - mw_query) / mw_query|)`
- 环数 × 0.1
- Lipinski 失败数 × 0.1
- 拓扑极性表面积 × 0.1
- 碳原子数 × 0.1
- 最终结构得分：`fingerprint_similarity × ∏(property_factor^{weight})`

#### 5.2 热物理相似性 (`thermalComparison`)
对每个用户选中的属性：`1 / (1 + |(value_cand - value_query) / value_query|)`

乘积形成热物理总分。

#### 5.3 毒性评估 (`toxicComparison`)
综合评分 = `LogBCF × (1 + CATMoS_EPA) × (LD50 / 1000)`，值越小毒性越高。

#### 5.4 合成可及性 (`SA Score`)
RDKit 的 `sascorer.calculateScore()` 返回 1-10 分（1 为最容易合成），
映射为：`10 - SA_score`（高分表示更好）。

### 阶段 6：归一化与加权 (`processDict`)
- 所有维度得分归一化到 `[0.45, 0.95]` 区间
- 按权重数组计算综合得分
- 排除查询自身后按综合得分降序排列
- 取前 `finnum` 个结果

### 阶段 7：输出生成
- **CSV**：`src/Comparison/LocalIO/data.csv`（单次搜索）
- **PDF 报告**：`src/App/static/LocalIO/report.pdf`
- **图表**：`src/App/static/LocalIO/graph.png`
- **批量**：合并所有结果的 `Combined-OPERA-Results.csv`

---

## 6. 命令行使用方式

### 6.1 输入文件格式

每行一个查询，逗号分隔参数：

```
query, final_number, thermo_array, include_all_elements, include_specific_elements, disallow_isotopes, substructure_search, number_substructure_search, weights(optional)
```

### 6.2 示例

```bash
# 搜索类似 CID 6517 的化合物，返回 30 个候选
6517, 30, [True,True,False,False,False], False, [Si], 1, CCO, 1

# 搜索 8-羟基喹啉，全元素允许，自定义权重
quinolin-8-ol, 30, [False,False,False,False,True], True, None, 0, None, None, [2,1,1,1,0]
```

### 6.3 运行命令

```bash
# 指定输出文件名
python src/main.py -i input.txt -o report_name

# 自动以时间命名输出文件
python src/main.py -i input.txt -t

# 启动 Web 应用
python src/main.py -w

# 使用自定义模型
python src/main.py -i input.txt -o report -m my_model_1 my_model_2
```

---

## 7. 环境要求

### 7.1 运行时依赖

| 组件 | 版本要求 |
|------|---------|
| Docker | 需支持 docker compose |
| Python | 3.9+ |
| Milvus | v2.5.7 (standalone) |
| etcd | v3.5.5 |
| MinIO | RELEASE.2023-03-20 |
| MATLAB Runtime | v912 (OPERA 依赖) |
| OPERA | v2.9 |

### 7.2 核心 Python 依赖

```
numpy>=1.24.0      # 数值计算
pandas>=1.5.3      # 数据处理
pubchempy==1.0.4   # PubChem API 客户端
rdkit>=2022.9.5    # 化学信息学工具包
pymilvus==2.5.0    # Milvus 向量数据库客户端
flask==2.3.2       # Web 框架
matplotlib>=3.7.0  # 图表生成
reportlab==4.0.9   # PDF 生成
fpdf2==2.7.7       # PDF 生成
pypdf==4.0.1       # PDF 合并
```

### 7.3 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CRS_PORT` | `5005` | Web 服务端口 |
| `HTTP_PROXY` | 空 | HTTP 代理 |
| `HTTPS_PROXY` | 空 | HTTPS 代理 |
| `PARTITION_DIVISION` | `10` | 每批搜索的 Milvus 分区数 |
| `NO_PROXY` | 空 | 代理白名单（建议加 `.ncbi.nlm.nih.gov`） |

### 7.4 Docker 服务

共 4 个容器：`etcd` → `minio` → `standalone`(Milvus) → `CRS`，通过 `docker compose up -d` 启动。

---

## 8. 作为 Agent 工具的集成建议

### 8.1 建议的 MCP Tool 定义

#### Tool 1: `search_similar_compounds`

```json
{
  "name": "search_similar_compounds",
  "description": "搜索与给定化合物结构相似、性质相近的候选化合物，支持 PubChem CID、IUPAC 名称或 SMILES 查询",
  "arguments": {
    "query": { "type": "string", "description": "查询输入：PubChem CID、IUPAC 名称或 SMILES 字符串" },
    "final_number": { "type": "integer", "description": "返回的候选化合物数量，默认 30", "default": 30 },
    "thermo_properties": { "type": "array", "items": { "type": "string" }, "description": "需要比较的热物理属性列表，可选: MeltingPoint, BoilingPoint, LogP, HenrysLaw, VaporPressure", "default": [] },
    "include_all_elements": { "type": "boolean", "description": "是否允许所有元素（默认仅允许 H,C,N,O,F,P,S,Cl,Se,Br,I）", "default": false },
    "include_specific_elements": { "type": "array", "items": { "type": "string" }, "description": "额外允许的元素符号列表", "default": [] },
    "disallow_isotopes": { "type": "boolean", "description": "是否禁止同位素候选", "default": false },
    "substructure_smarts": { "type": "string", "description": "SMARTS 子结构模式（可选）" },
    "substructure_count": { "type": "integer", "description": "子结构匹配次数要求（可选，None 表示 >=1）" },
    "weights": { "type": "array", "items": { "type": "number" }, "description": "5 维权重 [结构相似性, 分子量, 热物理, 毒性, 合成可及性]，默认 [1,1,1,1,1]", "default": [1,1,1,1,1] }
  }
}
```

#### Tool 2: `batch_search_compounds`

```json
{
  "name": "batch_search_compounds",
  "description": "批量搜索多个化合物的相似候选，一次提交多个查询",
  "arguments": {
    "queries": {
      "type": "array",
      "description": "批量查询列表，每项为一个查询的参数对象",
      "items": { "type": "object" }
    }
  }
}
```

### 8.2 调用示例

```
用户: "帮我找 20 个和布洛芬(Ibuprofen)结构相似的化合物"

Agent → MCP 调用:
  search_similar_compounds(
    query="Ibuprofen",
    final_number=20,
    thermo_properties=["MeltingPoint", "BoilingPoint"],
    include_all_elements=false,
    disallow_isotopes=false
  )
```

### 8.3 前提条件

1. CRS Docker 环境必须已启动（`docker compose up -d`）
2. Web API 在 `http://localhost:5005` 可用
3. 可通过直接调用 Python API 或 HTTP API 两种方式集成
