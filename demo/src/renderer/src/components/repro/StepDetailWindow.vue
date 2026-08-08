<template>
  <section class="sdw card">
    <!-- 标签栏：已打开步骤，点击切换；不允许重复 -->
    <div class="sdw-tabs">
      <div
        v-for="tab in openTabs"
        :key="tab.id"
        class="sdw-tab"
        :class="{ active: tab.id === activeStepId }"
        @click="activate(tab.id)"
      >
        <span class="sdw-tab-label"
          >步骤{{ tab.step_no }} · {{ tab.title || "未命名" }}</span
        >
        <button
          type="button"
          class="sdw-tab-close"
          title="关闭标签"
          @click.stop="closeTab(tab.id)"
        >
          ✕
        </button>
      </div>
      <span v-if="!openTabs.length" class="sdw-tabs-empty"
        >点击上方步骤卡片"打开详情"，在此窗口查看/录入该步骤的变量、事件、记录、数据、图表与预测</span
      >
    </div>

    <template v-if="activeStep">
      <!-- 变体切换（步骤级并行实验，v3 问题⑥） -->
      <div class="sdw-variants">
        <div class="sv-head">
          <b>并行实验（{{ variants.length + 1 }}）</b>
          <button type="button" class="sv-add" @click="openVariantCreate">
            ＋ 新建并行实验
          </button>
        </div>
        <div class="sv-list">
          <div
            class="sv-item"
            :class="{ active: activeExperimentId === null }"
            @click="activeExperimentId = null"
          >
            <span class="sv-name">默认执行</span>
            <span class="sv-tag">step_exp=null</span>
          </div>
          <div
            v-for="v in variants"
            :key="v.id"
            class="sv-item"
            :class="{ active: activeExperimentId === v.id }"
            @click="activeExperimentId = v.id"
          >
            <span class="sv-name">{{ v.name }}</span>
            <span class="sv-tag" :class="v.status === 'indexed' ? 'done' : ''">
              {{ v.status === "indexed" ? "已入库" : "待整理" }}
            </span>
            <button
              type="button"
              class="sv-edit"
              title="编辑变体"
              @click.stop="openVariantEdit(v)"
            >
              ✎
            </button>
            <button
              type="button"
              class="sv-del"
              title="删除变体"
              @click.stop="removeVariant(v)"
            >
              ✕
            </button>
          </div>
        </div>
        <p v-if="activeExperimentId !== null" class="sv-hint">
          当前查看变体「{{ variantName }}」的数据空间（仅显示该变体数据）。
        </p>
      </div>

      <!-- 步骤信息（可编辑，v3 问题④） -->
      <div class="sdw-step-info">
        <div v-if="!editingStep" class="si-view">
          <b class="si-title">{{
            activeStep.title || `步骤 ${activeStep.step_no}`
          }}</b>
          <div class="si-desc"><MarkdownRenderer :content="activeStep.description" /></div>
          <p v-if="activeStep.duration" class="si-dur">
            时长：{{ activeStep.duration }}
          </p>
          <p v-if="siConditions" class="si-cond">{{ siConditions }}</p>
          <button type="button" class="si-edit" @click="startEditStep">
            ✎ 编辑步骤信息
          </button>
        </div>
        <form v-else class="si-form" @submit.prevent="saveStepEdit">
          <label class="si-label"
            >标题
            <input
              v-model="editForm.title"
              class="si-input"
              type="text"
              maxlength="80"
            />
          </label>
          <label class="si-label"
            >描述
            <textarea
              v-model="editForm.description"
              class="si-input"
              rows="3"
            />
          </label>
          <label class="si-label"
            >时长
            <input
              v-model="editForm.duration"
              class="si-input"
              type="text"
              placeholder="如 2h"
            />
          </label>
          <label class="si-label"
            >备注
            <input v-model="editForm.notes" class="si-input" type="text" />
          </label>
          <label class="si-label"
            >条件（JSON，可空）
            <input
              v-model="editForm.conditionsText"
              class="si-input"
              type="text"
              placeholder='{"temperature":"80°C","time":"2h"}'
            />
          </label>
          <div class="si-actions">
            <span v-if="stepEditError" class="si-error">{{
              stepEditError
            }}</span>
            <button
              type="button"
              class="si-cancel"
              @click="editingStep = false"
            >
              取消
            </button>
            <button type="submit" class="si-save" :disabled="stepEditSaving">
              {{ stepEditSaving ? "保存中…" : "保存" }}
            </button>
          </div>
        </form>
      </div>

      <!-- 阶段实验变量（按步骤 + 变体） -->
      <div class="sdw-mod">
        <div class="sm-head">
          <b>阶段实验变量（{{ stepVariables.length }}）</b>
          <button type="button" class="sm-add" @click="addVariable">
            + 添加变量
          </button>
        </div>
        <div v-for="v in stepVariables" :key="v.id" class="sm-var">
          <span class="smv-name">{{ v.name }}</span>
          <span class="smv-key">{{ v.key }}</span>
          <span v-if="v.unit" class="smv-unit">{{ v.unit }}</span>
          <input
            v-model="v.current_value"
            class="smv-input"
            type="text"
            :placeholder="`默认 ${v.default_value || '—'}`"
            title="本次实际取值"
            @change="updateVariable(v)"
          />
          <button
            type="button"
            class="smv-del"
            title="删除变量"
            @click="removeVariable(v)"
          >
            ✕
          </button>
        </div>
        <p v-if="!stepVariables.length" class="sm-empty">
          暂无变量。可点击"添加变量"自定义，或在文献解析后由 Agent 生成。
        </p>
      </div>

      <!-- 实验事件（按步骤 + 变体，可附图片/视频） -->
      <div class="sdw-mod">
        <div class="sm-head">
          <b>实验事件（{{ stepEvents.length }}）</b>
        </div>
        <form class="sm-form" @submit.prevent="submitEvent">
          <input
            v-model="eventForm.name"
            class="si-input"
            type="text"
            placeholder="事件名称（如：反应液突然变黑）"
            required
            maxlength="60"
          />
          <textarea
            v-model="eventForm.content"
            class="si-input"
            rows="2"
            placeholder="事件描述（Markdown）"
          />
          <div class="sm-media">
            <button type="button" class="sm-pick" @click="pickEventMedia">
              选择图片/视频
            </button>
            <span v-if="eventForm.mediaPaths.length" class="sm-count"
              >{{ eventForm.mediaPaths.length }} 个</span
            >
            <div v-if="eventForm.mediaPaths.length" class="sm-previews">
              <div v-for="m in eventForm.mediaPaths" :key="m" class="sm-thumb">
                <img v-if="isImage(m) && imgSrc(m)" :src="imgSrc(m)" alt="" />
                <span v-else class="sm-file">{{ fileName(m) }}</span>
                <button
                  type="button"
                  class="sm-remove"
                  @click="removeEventMedia(m)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <div class="sm-actions">
            <span v-if="eventError" class="sm-error">{{ eventError }}</span>
            <button type="submit" class="sm-submit" :disabled="eventSubmitting">
              {{ eventSubmitting ? "保存中…" : "保存实验事件" }}
            </button>
          </div>
        </form>
        <div v-for="e in stepEvents" :key="e.id" class="sm-event">
          <div class="sme-head">
            <b>{{ e.name }}</b>
            <button type="button" class="sme-del" @click="deleteEvent(e)">
              ✕
            </button>
          </div>
          <p v-if="e.content" class="sme-content">{{ e.content }}</p>
          <div v-if="parseMedia(e.media_paths).length" class="sm-previews">
            <div
              v-for="m in parseMedia(e.media_paths)"
              :key="m"
              class="sm-thumb"
            >
              <img
                v-if="isImage(m) && imgSrc(m)"
                :src="imgSrc(m)"
                alt=""
                @click="openMedia(m)"
              />
              <span v-else class="sm-file" @click="openMedia(m)">{{
                fileName(m)
              }}</span>
            </div>
          </div>
        </div>
        <p v-if="!stepEvents.length" class="sm-empty">暂无事件。</p>
      </div>

      <!-- 新增记录 / 现象（按步骤 + 变体，含附件与统计图录数） -->
      <div class="sdw-mod">
        <div class="sm-head"><b>新增记录 / 现象</b></div>
        <form class="sm-form" @submit.prevent="submitRecord">
          <input
            v-model="recordForm.name"
            class="si-input"
            type="text"
            placeholder="记录名称（如：实验现象1-黄色沉淀）"
            required
            maxlength="60"
          />
          <textarea
            v-model="recordForm.content"
            class="si-input"
            rows="4"
            placeholder="填写数据/现象（Markdown，含化学式）"
            required
          />
          <div class="sm-media">
            <button type="button" class="sm-pick" @click="pickRecordMedia">
              选择附件（图片/视频）
            </button>
            <span v-if="recordForm.attachments.length" class="sm-count"
              >{{ recordForm.attachments.length }} 个</span
            >
            <div v-if="recordForm.attachments.length" class="sm-previews">
              <div
                v-for="m in recordForm.attachments"
                :key="m"
                class="sm-thumb"
              >
                <img v-if="isImage(m) && imgSrc(m)" :src="imgSrc(m)" alt="" />
                <span v-else class="sm-file">{{ fileName(m) }}</span>
                <button
                  type="button"
                  class="sm-remove"
                  @click="removeRecordMedia(m)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <ChartDataRecorder ref="chartRecorder" @change="onChartChange" />
          <div class="sm-actions">
            <span v-if="recordError" class="sm-error">{{ recordError }}</span>
            <button
              type="submit"
              class="sm-submit"
              :disabled="recordSubmitting"
            >
              {{
                recordSubmitting ? "分析保存中…" : "保存记录（自动分析符合度）"
              }}
            </button>
          </div>
        </form>
        <div v-if="lastResult" class="sm-result">
          <MarkdownRenderer :content="lastResult" />
        </div>

        <div
          v-for="r in stepRecords"
          :key="r.id"
          class="sm-record"
          :class="{ unexpected: r.is_expected === 0 }"
        >
          <div class="smr-head">
            <b>{{ r.name }}</b>
            <span class="badge" :class="r.is_expected === 1 ? 'ok' : 'bad'">
              {{ r.is_expected === 1 ? "符合" : "不符合" }} ·
              {{ r.compliance_percent ?? "N/A" }}%
            </span>
            <span v-if="r.vector_status === 'pending'" class="badge pending"
              >待入库</span
            >
          </div>
          <MarkdownRenderer :content="r.content" class="smr-content" />
          <p v-if="r.cause_analysis" class="smr-cause">
            <b>原因分析</b>：{{ r.cause_analysis }}
          </p>
          <div v-if="parseMedia(r.attachments).length" class="sm-previews">
            <div
              v-for="m in parseMedia(r.attachments)"
              :key="m"
              class="sm-thumb"
            >
              <img
                v-if="isImage(m) && imgSrc(m)"
                :src="imgSrc(m)"
                alt=""
                @click="openMedia(m)"
              />
              <span v-else class="sm-file" @click="openMedia(m)">{{
                fileName(m)
              }}</span>
            </div>
          </div>
          <RecordChart
            v-if="parseChart(r.chart_data)"
            :data="parseChart(r.chart_data)!"
          />
        </div>
        <p v-if="!stepRecords.length" class="sm-empty">暂无该步骤记录。</p>
      </div>

      <!-- 自定义数据 -->
      <div class="sdw-mod">
        <div class="sm-head">
          <b>自定义数据（{{ stepCustom.length }}）</b>
        </div>
        <form class="sm-form sm-form-row" @submit.prevent="addCustom">
          <input
            v-model="customForm.name"
            class="si-input"
            type="text"
            placeholder="名称（如：实际温度）"
            required
          />
          <input
            v-model="customForm.value"
            class="si-input"
            type="text"
            placeholder="数值/文本"
            required
          />
          <input
            v-model="customForm.unit"
            class="si-input sm-unit"
            type="text"
            placeholder="单位"
          />
          <button type="submit" class="sm-submit" :disabled="customSubmitting">
            添加
          </button>
        </form>
        <table v-if="stepCustom.length" class="tbl">
          <thead>
            <tr>
              <th>名称</th>
              <th>数值</th>
              <th>单位</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in stepCustom" :key="d.id">
              <td>{{ d.data_name }}</td>
              <td>{{ d.data_value }}</td>
              <td>{{ d.unit }}</td>
              <td>
                <button type="button" class="sme-del" @click="deleteCustom(d)">
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!stepCustom.length" class="sm-empty">暂无自定义数据。</p>
      </div>

      <!-- 文献图表（按步骤归属，ECharts 渲染，v3 问题⑧） -->
      <div class="sdw-mod">
        <div class="sm-head">
          <b>文献图表（{{ stepFigures.length }}）</b>
        </div>
        <p class="sm-hint">
          该步骤归属的文献图表（可在图表面板调整归属；仅展示已归属本步骤的图表）。
        </p>
        <div v-for="f in stepFigures" :key="String(f.id)" class="sm-figure">
          <div class="smf-head">
            <b class="smf-title"><FormulaText :content="String(f.caption ?? '') || `图表 ${String(f.figure_index ?? '')}`" /></b>
            <span class="smf-type">{{ f.figure_type || "未识别" }}</span>
          </div>
          <img
            v-if="String(f.image_path || '') && imgSrc(String(f.image_path))"
            :src="imgSrc(String(f.image_path))"
            class="smf-img"
            alt="原图"
          />
          <table v-if="parsedTable(f).length" class="smf-table">
            <tbody>
              <tr v-for="(row, ri) in parsedTable(f)" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci">
                  <FormulaText :content="cellText(cell)" />
                </td>
              </tr>
            </tbody>
          </table>
          <FigureChartCard
            v-else-if="parseFigureChart(f)"
            :data="parseFigureChart(f)!"
          />
          <p v-else-if="parsedDesc(f).description" class="smf-desc">
            <MarkdownRenderer :content="parsedDesc(f).description || ''" />
          </p>
          <p v-else-if="parsedDesc(f).smiles" class="smf-smiles">
            <b>SMILES</b>：{{ parsedDesc(f).smiles }}
          </p>
          <p v-if="f.ocr_text" class="smf-ocr">
            {{ f.ocr_text }}
          </p>
        </div>
        <p v-if="!stepFigures.length" class="sm-empty">
          暂无该步骤归属的文献图表。
        </p>
      </div>

      <!-- AI 预测实验（v3 问题⑤：每个步骤/变体内均可预测） -->
      <div class="sdw-mod">
        <div class="sm-head"><b>AI 预测实验</b></div>
        <p class="sm-hint">
          基于本步骤（变体）变量设定进行理论预测（预测/未验证，实际需实验确认）。
        </p>
        <div class="sm-vars">
          <div v-for="(v, i) in predictVars" :key="i" class="smv-row">
            <input
              v-model="v.name"
              class="si-input"
              type="text"
              placeholder="变量名"
            />
            <input
              v-model="v.value"
              class="si-input"
              type="text"
              placeholder="取值"
            />
            <input
              v-model="v.unit"
              class="si-input sm-unit"
              type="text"
              placeholder="单位"
            />
            <button
              type="button"
              class="sme-del"
              @click="predictVars.splice(i, 1)"
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            class="sm-add"
            @click="predictVars.push({ name: '', value: '', unit: '' })"
          >
            + 添加变量
          </button>
        </div>
        <button
          type="button"
          class="sm-submit"
          :disabled="predicting"
          @click="runPrediction"
        >
          {{ predicting ? "预测中…" : "运行 AI 预测实验" }}
        </button>
        <div v-for="p in stepPredictions" :key="p.id" class="sm-record">
          <div class="smr-head">
            <b>{{ p.name }}</b
            ><span class="badge pending">预测/未验证</span>
          </div>
          <MarkdownRenderer :content="predText(p)" />
        </div>
        <p v-if="!stepPredictions.length" class="sm-empty">
          暂无该步骤预测记录。
        </p>
      </div>

      <!-- 综合对比分析（v3 问题⑤：跨分支/步骤对比） -->
      <div class="sdw-mod">
        <div class="sm-head"><b>综合对比分析</b></div>
        <div class="cmp-row">
          <input
            v-model="cmpQuestion"
            class="si-input"
            type="text"
            placeholder="如：哪个实验条件最优？温度提高 10°C 会怎样？"
            @keydown.enter="runCompare"
          />
          <button
            type="button"
            class="sm-submit"
            :disabled="comparing"
            @click="runCompare"
          >
            {{ comparing ? "分析中…" : "综合对比分析" }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type {
  ProjectContextUI,
  StepUI,
  StepExperimentUI,
  PhaseVariableUI,
} from "../../stores/repro";
import { reproStore } from "../../stores/repro";
import MarkdownRenderer from "./MarkdownRenderer.vue";
import FormulaText from "./FormulaText.vue";
import ChartDataRecorder, {
  type ChartRecordData,
} from "./ChartDataRecorder.vue";
import RecordChart from "./RecordChart.vue";
import FigureChartCard from "./FigureChartCard.vue";

const props = defineProps<{
  ctx: ProjectContextUI | null
  currentBranchId: number | null
  /** embedded=嵌入主窗口面板；window=独立 Electron 步骤详情窗口（v3 问题③） */
  mode?: 'embedded' | 'window'
  /** window 模式：数据变更后通知父组件重载 context */
  onRequestRefresh?: () => void
}>()
const emit = defineEmits<{ changed: [] }>()

const api = window.api

/** 解析 ai:experiment-chat 回复的 messages 文本（window 模式直连对话用） */
function extractMessages(reply: string): string {
  try {
    const data = JSON.parse(reply) as { messages?: string }
    return typeof data.messages === 'string' ? data.messages : reply
  } catch {
    return reply
  }
};

/* ================= 标签页管理（v3 问题③：复用单窗口，标签不重复） ================= */
const openTabs = ref<StepUI[]>([]);
const activeStepId = ref<number | null>(null);

const activeStep = computed(
  () => openTabs.value.find((s) => s.id === activeStepId.value) ?? null,
);

/** 打开步骤详情（父组件步骤卡片调用）：已打开则仅激活标签，不重复添加 */
function openStep(step: StepUI): void {
  const exists = openTabs.value.find((s) => s.id === step.id);
  if (exists) {
    activeStepId.value = step.id;
    return;
  }
  openTabs.value.push(step);
  activeStepId.value = step.id;
  resetForms();
}

function activate(id: number): void {
  activeStepId.value = id;
  resetForms();
}

function closeTab(id: number): void {
  const idx = openTabs.value.findIndex((s) => s.id === id);
  if (idx < 0) return;
  openTabs.value.splice(idx, 1);
  if (activeStepId.value === id) {
    activeStepId.value =
      openTabs.value[idx]?.id ?? openTabs.value[idx - 1]?.id ?? null;
  }
}

defineExpose({ openStep });

/* ================= 步骤级并行实验变体（v3 问题⑥） ================= */
const activeExperimentId = ref<number | null>(null);

const variants = computed<StepExperimentUI[]>(() => {
  const step = activeStep.value;
  if (!step || !props.ctx) return [];
  return props.ctx.stepExperiments.filter(
    (e) =>
      e.step_id === step.id && (e.branch_id ?? null) === props.currentBranchId,
  );
});

const variantName = computed(() => {
  const v = variants.value.find((x) => x.id === activeExperimentId.value);
  return v ? v.name : "默认执行";
});

/* 新建/编辑变体（弹窗用 window.prompt 简化：名称 + 变量覆盖 JSON） */
function openVariantCreate(): void {
  const step = activeStep.value;
  if (!step || !props.ctx) return;
  const name = window.prompt("变体名称（如：变体A-温度80°C）");
  if (!name) return;
  const desc = window.prompt("变体说明（变量差异、目的，可空）") ?? "";
  void (async () => {
    try {
      await api.db.experiment.createStepExperiment({
        project_id: props.ctx?.project.id,
        step_id: step.id,
        branch_id: props.currentBranchId,
        name,
        description: desc,
      });
      await refresh();
    } catch (err) {
      console.error("[Component] StepDetailWindow 新建变体失败:", err);
      window.alert(
        `新建变体失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  })();
}

function openVariantEdit(v: StepExperimentUI): void {
  const name = window.prompt("变体名称", v.name);
  if (name === null) return;
  const desc = window.prompt("变体说明", v.description);
  if (desc === null) return;
  void (async () => {
    try {
      await api.db.experiment.updateStepExperiment(v.id, {
        name,
        description: desc,
      });
      await refresh();
    } catch (err) {
      console.error("[Component] StepDetailWindow 编辑变体失败:", err);
      window.alert(
        `编辑变体失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  })();
}

function removeVariant(v: StepExperimentUI): void {
  if (!window.confirm(`确认删除并行实验「${v.name}」及其全部数据？`)) return;
  void (async () => {
    try {
      await api.db.experiment.deleteStepExperiment(v.id);
      if (activeExperimentId.value === v.id) activeExperimentId.value = null;
      await refresh();
    } catch (err) {
      console.error("[Component] StepDetailWindow 删除变体失败:", err);
    }
  })();
}

/* ================= 步骤信息编辑（v3 问题④） ================= */
const editingStep = ref(false);
const editForm = reactive({
  title: "",
  description: "",
  duration: "",
  notes: "",
  conditionsText: "",
});
const stepEditError = ref("");
const stepEditSaving = ref(false);

const siConditions = computed(() => {
  const c = activeStep.value?.conditions;
  if (!c) return "";
  if (typeof c === "string") return c;
  return Object.entries(c)
    .map(([k, val]) => `${k}: ${val}`)
    .join(" · ");
});

function startEditStep(): void {
  const s = activeStep.value;
  if (!s) return;
  editForm.title = s.title ?? "";
  editForm.description = s.description ?? "";
  editForm.duration = s.duration ?? "";
  editForm.notes = s.notes ?? "";
  editForm.conditionsText =
    typeof s.conditions === "string"
      ? s.conditions
      : JSON.stringify(s.conditions ?? {});
  editingStep.value = true;
  stepEditError.value = "";
}

async function saveStepEdit(): Promise<void> {
  const s = activeStep.value;
  if (!s) return;
  stepEditSaving.value = true;
  try {
    let conditions: Record<string, string> | undefined;
    if (editForm.conditionsText.trim()) {
      try {
        const parsed = JSON.parse(editForm.conditionsText) as Record<
          string,
          string
        >;
        if (parsed && typeof parsed === "object") conditions = parsed;
      } catch {
        stepEditError.value = '条件需为 JSON 对象（如 {"temperature":"80°C"}）';
        return;
      }
    }
    await api.db.experiment.updateStep(s.id, {
      title: editForm.title,
      description: editForm.description,
      duration: editForm.duration,
      notes: editForm.notes,
      conditions,
    });
    editingStep.value = false;
    // 更新本地标签标题
    const tab = openTabs.value.find((t) => t.id === s.id);
    if (tab) tab.title = editForm.title;
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 编辑步骤失败:", err);
    stepEditError.value = `保存失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    stepEditSaving.value = false;
  }
}

/* ================= 数据过滤（按步骤 + 变体 + 分支） ================= */
function matchScope(x: {
  step_id?: number | null;
  step_experiment_id?: number | null;
  branch_id?: number | null;
}): boolean {
  const step = activeStep.value;
  if (!step) return false;
  return (
    (x.step_id ?? null) === step.id &&
    (x.step_experiment_id ?? null) === activeExperimentId.value &&
    (x.branch_id ?? null) === props.currentBranchId
  );
}

const stepVariables = computed(() =>
  (props.ctx?.phaseVariables ?? []).filter(matchScope),
);
const stepEvents = computed(() => (props.ctx?.events ?? []).filter(matchScope));
const stepRecords = computed(() =>
  (props.ctx?.records ?? []).filter(matchScope),
);
const stepCustom = computed(() =>
  (props.ctx?.customData ?? []).filter(matchScope),
);
const stepPredictions = computed(() =>
  (props.ctx?.predictions ?? []).filter(matchScope),
);

/* ================= 阶段实验变量 ================= */
async function addVariable(): Promise<void> {
  const step = activeStep.value;
  if (!step || !props.ctx) return;
  const key = `var_${step.id}_${Date.now() % 100000}`;
  try {
    await api.db.experiment.upsertPhaseVariable({
      project_id: props.ctx.project.id,
      phase_id: 0,
      step_id: step.id,
      branch_id: props.currentBranchId,
      step_experiment_id: activeExperimentId.value,
      key,
      name: "新变量",
      type: "other",
      unit: "",
      default_value: "",
      current_value: "",
      options: "[]",
      is_agent_generated: 0,
      description: "",
      sort_order: stepVariables.value.length + 1,
    });
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 添加变量失败:", err);
  }
}

async function updateVariable(v: PhaseVariableUI): Promise<void> {
  try {
    await api.db.experiment.upsertPhaseVariable({ ...v, id: v.id } as never);
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 更新变量失败:", err);
  }
}

async function removeVariable(v: PhaseVariableUI): Promise<void> {
  try {
    await api.db.experiment.deletePhaseVariable(v.id);
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 删除变量失败:", err);
  }
}

/* ================= 实验事件 ================= */
const eventForm = reactive<{
  name: string;
  content: string;
  mediaPaths: string[];
}>({ name: "", content: "", mediaPaths: [] });
const eventError = ref("");
const eventSubmitting = ref(false);

async function pickEventMedia(): Promise<void> {
  const paths = await api.file.pickMedia();
  if (!paths.length || !props.ctx) return;
  try {
    const persisted = await api.file.importMedia(props.ctx.project.id, paths);
    eventForm.mediaPaths.push(...persisted);
  } catch (err) {
    console.error("[Component] StepDetailWindow 导入事件附件失败:", err);
  }
}

function removeEventMedia(m: string): void {
  eventForm.mediaPaths = eventForm.mediaPaths.filter((x) => x !== m);
}

async function submitEvent(): Promise<void> {
  const step = activeStep.value;
  if (!step || !props.ctx || !eventForm.name.trim()) {
    eventError.value = "请填写事件名称。";
    return;
  }
  eventError.value = "";
  eventSubmitting.value = true;
  try {
    await api.db.experiment.addEvent({
      project_id: props.ctx.project.id,
      branch_id: props.currentBranchId,
      step_id: step.id,
      step_experiment_id: activeExperimentId.value,
      name: eventForm.name.trim(),
      content: eventForm.content.trim(),
      media_paths: [...eventForm.mediaPaths],
    });
    eventForm.name = "";
    eventForm.content = "";
    eventForm.mediaPaths = [];
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 保存事件失败:", err);
    eventError.value = `保存失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    eventSubmitting.value = false;
  }
}

async function deleteEvent(e: { id: number }): Promise<void> {
  try {
    await api.db.experiment.deleteEvent(e.id);
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 删除事件失败:", err);
  }
}

/* ================= 记录/现象 ================= */
const recordForm = reactive<{
  name: string;
  content: string;
  attachments: string[];
}>({ name: "", content: "", attachments: [] });
const recordError = ref("");
const recordSubmitting = ref(false);
const lastResult = ref("");
const chartRecorder = ref<InstanceType<typeof ChartDataRecorder> | null>(null);
const pendingChart = ref<ChartRecordData | null>(null);

function onChartChange(data: ChartRecordData | null): void {
  pendingChart.value = data;
}

async function pickRecordMedia(): Promise<void> {
  const paths = await api.file.pickMedia();
  if (!paths.length || !props.ctx) return;
  try {
    const persisted = await api.file.importMedia(props.ctx.project.id, paths);
    recordForm.attachments.push(...persisted);
  } catch (err) {
    console.error("[Component] StepDetailWindow 导入记录附件失败:", err);
  }
}

function removeRecordMedia(m: string): void {
  recordForm.attachments = recordForm.attachments.filter((x) => x !== m);
}

async function submitRecord(): Promise<void> {
  const step = activeStep.value;
  if (!step || !props.ctx) {
    recordError.value = "请先打开步骤详情。";
    return;
  }
  if (!recordForm.name.trim() || !recordForm.content.trim()) {
    recordError.value = "请填写记录名称与内容。";
    return;
  }
  recordError.value = "";
  recordSubmitting.value = true;
  try {
    const chartData =
      chartRecorder.value?.chartData ?? pendingChart.value ?? null;
    const result = await api.ai.saveRecord({
      project_id: props.ctx.project.id,
      step_id: step.id,
      branch_id: props.currentBranchId ?? undefined,
      step_experiment_id: activeExperimentId.value ?? undefined,
      name: recordForm.name.trim(),
      content: recordForm.content.trim(),
      attachments: recordForm.attachments.length
        ? [...recordForm.attachments]
        : undefined,
      chart_data: (chartData ?? undefined) as
        | Record<string, unknown>
        | undefined,
    });
    lastResult.value = result.text;
    recordForm.name = "";
    recordForm.content = "";
    recordForm.attachments = [];
    chartRecorder.value?.clear();
    pendingChart.value = null;
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 保存记录失败:", err);
    recordError.value = `保存失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    recordSubmitting.value = false;
  }
}

/* ================= 自定义数据 ================= */
const customForm = reactive({ name: "", value: "", unit: "" });
const customSubmitting = ref(false);

async function addCustom(): Promise<void> {
  const step = activeStep.value;
  if (!step || !props.ctx || !customForm.name.trim()) return;
  customSubmitting.value = true;
  try {
    await api.db.experiment.addCustomData(props.ctx.project.id, {
      step_id: step.id,
      step_experiment_id: activeExperimentId.value,
      data_name: customForm.name.trim(),
      data_type: "other",
      data_value: customForm.value.trim(),
      unit: customForm.unit.trim(),
    });
    customForm.name = "";
    customForm.value = "";
    customForm.unit = "";
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 添加自定义数据失败:", err);
  } finally {
    customSubmitting.value = false;
  }
}

async function deleteCustom(d: { id: number }): Promise<void> {
  try {
    await api.db.experiment.deleteCustomData(d.id);
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 删除自定义数据失败:", err);
  }
}

/* ================= 文献图表（v3 问题⑧） ================= */
const allFigures = ref<Array<Record<string, unknown>>>([]);

async function loadFigures(): Promise<void> {
  if (!props.ctx) return;
  try {
    allFigures.value = (await api.db.figure.listByProject(
      props.ctx.project.id,
    )) as Array<Record<string, unknown>>;
  } catch (err) {
    console.error("[Component] StepDetailWindow 加载图表失败:", err);
  }
}

const stepFigures = computed(() => {
  const step = activeStep.value;
  if (!step) return [];
  return allFigures.value.filter((f) => Number(f.step_id) === step.id);
});

/** 兼容模型输出的表格字符串（JSON 数组字符串 / HTML 表格字符串），返回二维数组或 null */
function parseTableString(table: unknown): unknown[][] | null {
  if (Array.isArray(table)) return table;
  if (typeof table !== "string") return null;
  const trimmed = table.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return arr as unknown[][];
    } catch {
      /* 继续尝试 HTML 解析 */
    }
  }
  // HTML 表格字符串 → 逐行逐格提取
  const rows: unknown[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(trimmed)) !== null) {
    const cells: unknown[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      cells.push(cellText(tdMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows.length ? rows : null;
}

/** 表格类文献图表 → 二维数组（供 HTML 表格渲染，避免误用柱状图） */
function parsedTable(f: Record<string, unknown>): unknown[][] {
  try {
    const obj = JSON.parse(String(f.structured_data ?? "{}")) as { table?: unknown };
    return parseTableString(obj.table) ?? [];
  } catch {
    return [];
  }
}

/** 非表格类文献图表（谱图/数据图）→ ECharts 数据，无则 null */
function parseFigureChart(f: Record<string, unknown>): ChartRecordData | null {
  try {
    const obj = JSON.parse(String(f.structured_data ?? "{}")) as ChartRecordData & {
      spectrum?: { x: number[]; y: number[] };
      chart?: { series?: unknown[] };
    };
    return (Array.isArray(obj.series) ||
      (Array.isArray(obj.spectrum?.x) && Array.isArray(obj.spectrum?.y)) ||
      (Array.isArray(obj.chart?.series) && (obj.chart?.series?.length ?? 0) > 0))
      ? obj
      : null;
  } catch {
    return null;
  }
}

/** 清洗表格单元格：剔除 HTML 标签并还原常见实体 */
function cellText(cell: unknown): string {
  return String(cell ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** 解析图表结构数据中的文本类字段（描述/SMILES），供无数据图时展示 */
function parsedDesc(raw: unknown): { description?: string; smiles?: string } {
  try {
    const obj = JSON.parse(String(raw ?? "{}")) as { description?: string; smiles?: string };
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/* ================= AI 预测实验（v3 问题⑤） ================= */
const predictVars = ref<Array<{ name: string; value: string; unit: string }>>([
  { name: "反应温度", value: "", unit: "°C" },
  { name: "反应时间", value: "", unit: "h" },
]);
const predicting = ref(false);

async function runPrediction(): Promise<void> {
  const step = activeStep.value;
  if (!step || !props.ctx) return;
  predicting.value = true;
  try {
    const desc = predictVars.value
      .filter((v) => v.name && v.value)
      .map((v) => `${v.name}: ${v.value}${v.unit}`)
      .join("；");
    const message =
      `请对项目 ${props.ctx.project.id} 中步骤"${step.title || step.step_no}"（分支 ${props.currentBranchId ?? "主线"}，变体 ${variantName.value}）进行 AI 预测实验（理论依据必须充分）。` +
      `请调用 run_prediction_experiment 工具（step_id=${step.id}${props.currentBranchId !== null ? `, branch_id=${props.currentBranchId}` : ""}${activeExperimentId.value !== null ? `, step_experiment_id=${activeExperimentId.value}` : ""}），` +
      `变量设定为：${desc || "沿用步骤默认变量"}，并给出预测结果、性质分析与理论依据。`;
    // 直连 agent 并在本地面板展示结果（不注入聊天框；独立窗口与内嵌模式统一处理）
    const reply = await api.ai.experimentChat({ projectId: props.ctx.project.id, message, history: [] });
    lastResult.value = extractMessages(reply);
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 预测实验异常:", err);
  } finally {
    predicting.value = false;
  }
}

function predText(p: {
  variables?: string;
  predicted_result?: string;
  property_analysis?: string;
  theory_basis?: string;
}): string {
  let vars = "";
  try {
    const arr = JSON.parse(p.variables || "[]") as Array<{
      name?: string;
      value?: string | number;
      unit?: string;
    }>;
    vars = arr.map((v) => `${v.name}: ${v.value}${v.unit}`).join("；");
  } catch {
    /* 忽略 */
  }
  return `**变量设定**：${vars || "—"}\n\n${p.predicted_result}\n\n**性质分析**：${p.property_analysis}\n\n**理论依据**：${p.theory_basis}`;
}

/* ================= 综合对比分析（v3 问题⑤） ================= */
const cmpQuestion = ref("");
const comparing = ref(false);

async function runCompare(): Promise<void> {
  if (!props.ctx || !cmpQuestion.value.trim()) return;
  comparing.value = true;
  try {
    const message =
      `请对本项目进行综合对比分析。问题：${cmpQuestion.value.trim()}。请调用 comprehensive_analysis 工具，综合所有分叉/主线的真实数据 + AI 预测结果 + 文献内容（含参考项目文献，引用时标注来源项目）回答，并附对比图表。`;
    // 直连 agent 并在本地面板展示结果（不注入聊天框；独立窗口与内嵌模式统一处理）
    const reply = await api.ai.experimentChat({ projectId: props.ctx.project.id, message, history: [] });
    lastResult.value = extractMessages(reply);
    cmpQuestion.value = "";
    await refresh();
  } catch (err) {
    console.error("[Component] StepDetailWindow 综合对比分析异常:", err);
  } finally {
    comparing.value = false;
  }
}

/* ================= 媒体辅助 ================= */
// reactive Map：readMedia 异步完成后触发重渲染，否则 <img> 永远不出现
const imgCache = reactive(new Map<string, string>());
const imgLoading = new Set<string>();

function isImage(p: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(p);
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function imgSrc(p: string): string {
  const cached = imgCache.get(p);
  if (cached) return cached;
  if (imgLoading.has(p)) return "";
  imgLoading.add(p);
  void api.file.readMedia(p).then((url) => {
    if (url) imgCache.set(p, url);
    imgLoading.delete(p);
  });
  return "";
}

function openMedia(p: string): void {
  void api.file.openMedia(p);
}

function parseMedia(raw: string | undefined | null): string[] {
  try {
    const arr = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function parseChart(raw: string | undefined | null): ChartRecordData | null {
  try {
    const obj = JSON.parse(raw || "{}") as ChartRecordData;
    return obj && typeof obj === "object" && Array.isArray(obj.series)
      ? obj
      : null;
  } catch {
    return null;
  }
}

/* ================= 刷新 ================= */
function resetForms(): void {
  editingStep.value = false;
  eventForm.name = "";
  eventForm.content = "";
  eventForm.mediaPaths = [];
  recordForm.name = "";
  recordForm.content = "";
  recordForm.attachments = [];
  recordError.value = "";
  eventError.value = "";
  lastResult.value = "";
}

async function refresh(): Promise<void> {
  if (props.mode === "window") {
    // 独立窗口模式：通知父组件（StepDetailPage）重载 context，不经过主窗口 store
    props.onRequestRefresh?.();
  } else {
    await reproStore.refreshContext();
  }
  await loadFigures();
  emit("changed");
}

watch(
  () => props.ctx?.project.id,
  () => {
    loadFigures();
  },
);

watch(
  () => [props.currentBranchId, activeStepId.value],
  () => {
    activeExperimentId.value = null;
    resetForms();
  },
);

// 初始加载图表
void loadFigures();
</script>

<style scoped>
.card {
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-alt);
}
.sdw {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sdw-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}
.sdw-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--color-surface);
}
.sdw-tab.active {
  border-color: var(--color-primary-light);
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
}
.sdw-tab-label {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sdw-tab-close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 11px;
}
.sdw-tab-close:hover {
  color: var(--color-danger);
}
.sdw-tabs-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 4px 2px;
}

.sdw-variants {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 10px;
}
.sv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--color-text-muted);
}
.sv-add {
  padding: 4px 10px;
  border: 1px solid var(--color-primary-light);
  border-radius: 7px;
  background: transparent;
  color: var(--color-primary);
  font-size: 11.5px;
  cursor: pointer;
}
.sv-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.sv-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  background: var(--color-surface);
}
.sv-item.active {
  border-color: var(--color-primary-light);
  background: rgba(99, 102, 241, 0.1);
}
.sv-name {
  font-weight: 600;
}
.sv-tag {
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 10.5px;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
}
.sv-tag.done {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.12);
}
.sv-edit {
  border: none;
  background: transparent;
  color: var(--color-accent-ink);
  cursor: pointer;
  font-size: 12px;
}
.sv-del {
  border: none;
  background: transparent;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 12px;
}
.sv-hint {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--color-accent-ink);
}

.sdw-step-info {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--color-surface);
}
.si-title {
  font-size: 13px;
  color: var(--color-text);
}
.si-desc {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--color-text);
  line-height: 1.6;
}
.si-dur,
.si-cond {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
.si-edit {
  margin-top: 8px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: transparent;
  color: var(--color-accent-ink);
  font-size: 11.5px;
  cursor: pointer;
}
.si-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.si-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.si-input {
  padding: 7px 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12.5px;
  outline: none;
}
.si-input:focus {
  border-color: var(--color-primary-light);
}
.si-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
.si-error {
  margin-right: auto;
  font-size: 12px;
  color: var(--color-danger);
}
.si-cancel {
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.si-save {
  padding: 5px 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.si-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sdw-mod {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--color-surface);
}
.sm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12.5px;
  color: var(--color-text);
}
.sm-add {
  padding: 3px 10px;
  border: 1px solid var(--color-primary-light);
  border-radius: 7px;
  background: transparent;
  color: var(--color-primary);
  font-size: 11.5px;
  cursor: pointer;
}
.sm-empty {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
.sm-hint {
  margin: -4px 0 8px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.sm-var {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.smv-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
}
.smv-key {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: monospace;
}
.smv-unit {
  font-size: 11px;
  color: var(--color-text-muted);
}
.smv-input {
  width: 120px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
}
.smv-input:focus {
  border-color: var(--color-primary-light);
}
.smv-del,
.sme-del {
  border: none;
  background: transparent;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 13px;
}

.sm-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}
.sm-form-row {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.sm-media {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sm-pick {
  align-self: flex-start;
  padding: 5px 12px;
  border: 1px solid var(--color-primary-light);
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
}
.sm-count {
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.sm-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sm-thumb {
  position: relative;
  width: 72px;
  height: 72px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-alt);
  cursor: pointer;
}
.sm-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sm-file {
  font-size: 10px;
  color: var(--color-text-muted);
  padding: 0 4px;
  word-break: break-all;
}
.sm-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}
.sm-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sm-error {
  margin: 0;
  font-size: 12px;
  color: var(--color-danger);
}
.sm-submit {
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.sm-submit:hover:not(:disabled) {
  opacity: 0.9;
}
.sm-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sm-unit {
  width: 90px;
}
.sm-result {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
}
.sm-event,
.sm-record {
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  margin-bottom: 8px;
}
.sm-record.unexpected {
  border-color: rgba(244, 63, 94, 0.4);
}
.sme-head,
.smr-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.sme-content {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--color-text);
  line-height: 1.6;
}
.smr-content {
  margin: 4px 0;
}
.smr-cause {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}
.badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
}
.badge.ok {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.12);
}
.badge.bad {
  color: var(--color-danger);
  background: rgba(244, 63, 94, 0.12);
}
.badge.pending {
  color: var(--color-warning);
  background: rgba(249, 115, 22, 0.12);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.tbl th,
.tbl td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
.tbl th {
  color: var(--color-text-muted);
  font-weight: 600;
}
.sm-figure {
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  margin-bottom: 8px;
}
.smf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.smf-type {
  font-size: 11px;
  color: var(--color-text-muted);
}
.smf-img {
  display: block;
  max-width: 100%;
  max-height: 220px;
  margin: 0 0 6px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  object-fit: contain;
  background: #fff;
}
.smf-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 6px;
  font-size: 12px;
}
.smf-table td {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  word-break: break-word;
}
.smf-desc {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--color-text);
}
.smf-smiles {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--color-accent-ink);
}
.smf-ocr {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.sm-vars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.smv-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.cmp-row {
  display: flex;
  gap: 8px;
}
</style>
