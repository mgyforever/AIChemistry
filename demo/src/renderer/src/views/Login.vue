<template>
  <div ref="rootRef" class="login-page">
    <!-- ================= 左侧：分子视觉区 ================= -->
    <aside class="visual-panel">
      <div class="hex-lattice"></div>

      <!-- 漂浮六边形装饰 -->
      <div class="float-hex hex-1">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
      <div class="float-hex hex-2">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
      <div class="float-hex hex-3">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M50 4 L92 27 L92 73 L50 96 L8 73 L8 27 Z" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>

      <div class="visual-content">
        <!-- 原子轨道动画 -->
        <div class="molecule-wrap">
          <svg class="molecule" viewBox="0 0 400 400" fill="none">
            <defs>
              <radialGradient id="nucleusGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#7dd3fc" />
                <stop offset="45%" stop-color="#22d3ee" />
                <stop offset="100%" stop-color="#4f46e5" />
              </radialGradient>
              <radialGradient id="nucleusGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45" />
                <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
              </radialGradient>
            </defs>

            <!-- 原子核 -->
            <circle class="nucleus" cx="200" cy="200" r="150" fill="url(#nucleusGlow)" />
            <circle class="nucleus-core" cx="200" cy="200" r="30" fill="url(#nucleusGrad)" />
            <circle class="nucleus-ring" cx="200" cy="200" r="44" stroke="#22d3ee" stroke-opacity="0.35" stroke-width="1.5" />

            <!-- 轨道 1 -->
            <g class="orbit orbit-1">
              <ellipse cx="200" cy="200" rx="160" ry="56" stroke="#4f46e5" stroke-opacity="0.6" stroke-width="1.5" />
              <circle class="electron" cx="360" cy="200" r="9" fill="#22d3ee" />
              <circle cx="360" cy="200" r="17" fill="#22d3ee" opacity="0.22" />
              <circle class="electron" cx="40" cy="200" r="9" fill="#22d3ee" />
              <circle cx="40" cy="200" r="17" fill="#22d3ee" opacity="0.22" />
            </g>
            <!-- 轨道 2 -->
            <g class="orbit orbit-2">
              <ellipse cx="200" cy="200" rx="160" ry="56" stroke="#22d3ee" stroke-opacity="0.4" stroke-width="1.5" />
              <circle class="electron" cx="360" cy="200" r="7" fill="#a78bfa" />
              <circle cx="360" cy="200" r="14" fill="#a78bfa" opacity="0.2" />
              <circle class="electron" cx="40" cy="200" r="7" fill="#a78bfa" />
              <circle cx="40" cy="200" r="14" fill="#a78bfa" opacity="0.2" />
            </g>
            <!-- 轨道 3 -->
            <g class="orbit orbit-3">
              <ellipse cx="200" cy="200" rx="160" ry="56" stroke="#6366f1" stroke-opacity="0.5" stroke-width="1.5" />
              <circle class="electron" cx="360" cy="200" r="7" fill="#f9e2af" />
              <circle cx="360" cy="200" r="14" fill="#f9e2af" opacity="0.2" />
              <circle class="electron" cx="40" cy="200" r="7" fill="#f9e2af" />
              <circle cx="40" cy="200" r="14" fill="#f9e2af" opacity="0.2" />
            </g>
          </svg>
        </div>

        <div class="visual-copy">
          <p class="visual-tag">AI · CHEM · LAB</p>
          <h1 class="visual-title">AIChemistry</h1>
          <p class="visual-sub">基于 AI 的化合物推荐与检索平台</p>
        </div>

        <!-- 漂浮化学式 -->
        <span class="formula-chip chip-1">H<sub>2</sub>O</span>
        <span class="formula-chip chip-2">C<sub>6</sub>H<sub>6</sub></span>
        <span class="formula-chip chip-3">CO<sub>2</sub></span>
        <span class="formula-chip chip-4">NH<sub>3</sub></span>
        <span class="formula-chip chip-5">CH<sub>3</sub>COOH</span>
      </div>
    </aside>

    <!-- ================= 右侧：登录表单 ================= -->
    <section class="form-panel">
      <!-- 主题切换 -->
      <button class="theme-toggle" type="button" aria-label="切换主题" @click="themeStore.toggle()">
        <svg v-if="themeStore.mode === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>

      <div class="form-inner">
        <!-- Logo -->
        <div class="login-logo">
          <div class="logo-badge">
            <svg viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stop-color="#22d3ee" />
                  <stop offset="100%" stop-color="#4f46e5" />
                </linearGradient>
              </defs>
              <path d="M24 4 L42 13.9 L42 34.1 L24 44 L6 34.1 L6 13.9 Z" fill="none" stroke="url(#logoGrad)" stroke-width="2.5" stroke-linejoin="round" />
              <circle cx="24" cy="24" r="9.5" fill="none" stroke="url(#logoGrad)" stroke-width="1.4" />
              <text x="24" y="28.5" text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="700" fill="#cdd6f4">Ai</text>
            </svg>
          </div>
          <span class="logo-text">AIChemistry</span>
        </div>

        <h2 class="login-title">欢迎回来</h2>
        <p class="login-subtitle">登录你的 AIChemistry 实验室账号</p>

        <form ref="formRef" class="login-form" novalidate @submit.prevent="handleLogin">
          <div class="form-field">
            <label for="username">用户名 / 邮箱</label>
            <div class="input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
                <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
              </svg>
              <input
                id="username"
                v-model="username"
                type="text"
                autocomplete="username"
                placeholder="请输入用户名或邮箱"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="form-field">
            <label for="password">密码</label>
            <div class="input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
              </svg>
              <input
                id="password"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入密码"
                :disabled="loading"
              />
              <button
                class="pwd-toggle"
                type="button"
                aria-label="切换密码可见性"
                @click="showPwd = !showPwd"
              >
                <svg v-if="showPwd" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <div class="form-options">
            <label class="checkbox">
              <input v-model="remember" type="checkbox" />
              <span class="checkbox-box">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 6.5L4.5 9L10 3" />
                </svg>
              </span>
              <span>记住我</span>
            </label>
            <a class="forgot-link" href="#" @click.prevent>忘记密码？</a>
          </div>

          <button ref="btnRef" class="login-btn" type="submit" :disabled="loading">
            <svg v-if="loading" class="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <span>{{ loading ? '正在验证…' : '登录' }}</span>
          </button>
        </form>

        <div class="form-footer">
          <div class="divider"><span>或使用以下方式</span></div>
          <div class="social-row">
            <button type="button" class="social-btn" @click="mockSocial">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.04 11.04 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              <span>GitHub</span>
            </button>
            <button type="button" class="social-btn" @click="mockSocial">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44-3.99 0-7.24-3.23-7.24-7.2 0-3.97 3.25-7.2 7.24-7.2 1.76 0 3.37.64 4.62 1.7l2.04-2.04C16.99 3.17 15.06 2.22 12.19 2.22c-5.4 0-9.74 4.34-9.74 9.74s4.34 9.74 9.74 9.74c5.62 0 9.36-3.95 9.36-9.5 0-.64-.06-1.28-.2-1.9Z" />
              </svg>
              <span>Google</span>
            </button>
          </div>
          <p class="register-hint">还没有账号？<a href="#" class="register-link" @click.prevent="router.push('/register')">立即注册</a></p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import { themeStore } from '../stores/theme'
import { methods } from '../methods/idnex'
import { FastifyApi } from '../fastifyApi'
import type { LoginBody, LoginResponse } from '../type'

const router = useRouter()
const { authRequest } = methods()
const fastifyApi = new FastifyApi()

const rootRef = ref<HTMLElement | null>(null)
const formRef = ref<HTMLElement | null>(null)
const btnRef = ref<HTMLButtonElement | null>(null)

const username = ref('')
const password = ref('')
const remember = ref(false)
const showPwd = ref(false)
const loading = ref(false)
const error = ref('')

let mm: gsap.MatchMedia | null = null

onMounted(() => {
  console.log('[View] Login 挂载')
  if (!rootRef.value) return

  mm = gsap.matchMedia()

  // 正常动画：原子轨道旋转、漂浮元素、入场动画
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // 原子轨道持续旋转
    gsap.to('.orbit-1', { rotation: 360, svgOrigin: '200 200', duration: 10, repeat: -1, ease: 'none' })
    gsap.to('.orbit-2', { rotation: -360, svgOrigin: '200 200', duration: 15, repeat: -1, ease: 'none' })
    gsap.to('.orbit-3', { rotation: 360, svgOrigin: '200 200', duration: 12, repeat: -1, ease: 'none' })
    gsap.to('.nucleus-core', { scale: 1.08, transformOrigin: '200px 200px', duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.nucleus', { scale: 1.15, transformOrigin: '200px 200px', duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })

    // 漂浮六边形缓慢旋转
    gsap.to('.hex-1', { rotation: 360, duration: 70, repeat: -1, ease: 'none' })
    gsap.to('.hex-2', { rotation: -360, duration: 90, repeat: -1, ease: 'none' })
    gsap.to('.hex-3', { rotation: 360, duration: 55, repeat: -1, ease: 'none' })

    // 化学式标签漂浮
    gsap.to('.formula-chip', {
      y: '+=14',
      duration: 4.5,
      stagger: 0.7,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    })

    // 左侧面板入场
    gsap.from('.visual-panel', { autoAlpha: 0, xPercent: -8, duration: 1.1, ease: 'power2.out' })
    gsap.from('.molecule-wrap', { autoAlpha: 0, scale: 0.88, duration: 1.2, ease: 'power3.out', delay: 0.15 })

    // 右侧表单入场（错落节奏）
    const tl = gsap.timeline({ delay: 0.25, defaults: { ease: 'power3.out' } })
    tl.from('.login-logo', { y: -18, autoAlpha: 0, duration: 0.55 })
      .from('.login-title', { y: 14, autoAlpha: 0, duration: 0.45 }, '-=0.25')
      .from('.login-subtitle', { y: 14, autoAlpha: 0, duration: 0.45 }, '-=0.3')
      .from('.form-field', { y: 18, autoAlpha: 0, duration: 0.45, stagger: 0.1 }, '-=0.3')
      .from('.form-options', { autoAlpha: 0, duration: 0.35 }, '-=0.25')
      .from('.login-btn', { y: 14, autoAlpha: 0, duration: 0.45 }, '-=0.25')
      .from('.form-footer', { autoAlpha: 0, duration: 0.4 }, '-=0.2')
  })

  // 无障碍：减少动态效果时保持静态
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(['.orbit-1', '.orbit-2', '.orbit-3'], { rotation: 0 })
  })
})

onBeforeUnmount(() => {
  mm?.revert()
})

/** 校验用户名：3~20 位，仅限字母、数字、下划线 */
function validateUsername(name: string): string {
  if (!name) return '请输入用户名'
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return '用户名需为 3-20 位字母、数字或下划线'
  return ''
}

/** 校验密码：6~32 位 */
function validatePassword(pwd: string): string {
  if (!pwd) return '请输入密码'
  if (pwd.length < 6 || pwd.length > 32) return '密码长度需为 6-32 位'
  return ''
}

async function handleLogin(): Promise<void> {
  console.log('[View] 登录提交, 用户名:', username.value.trim())
  const usernameError = validateUsername(username.value.trim())
  const passwordError = validatePassword(password.value)
  if (usernameError || passwordError) {
    error.value = usernameError || passwordError
    shake(formRef.value)
    return
  }

  error.value = ''
  loading.value = true

  // 按钮按下反馈
  if (btnRef.value) {
    gsap.fromTo(btnRef.value, { scale: 1 }, { scale: 0.97, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'scale' })
  }

  try {
    const body: LoginBody = {
      username: username.value.trim(),
      password: password.value
    }

    const res = (await authRequest({
      url: fastifyApi.baseUrl + fastifyApi.loginUrl,
      method: 'POST',
      body: body as Record<string, any>
    })) as LoginResponse

    // 保存登录令牌
    if (res.data?.token) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    }

    // 登录成功，进入主界面
    console.log('[View] 登录成功，跳转 /chat')
    router.push('/chat')
  } catch (err) {
    console.error('登录失败:', err)
    error.value = '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}

function mockSocial(): void {
  error.value = ''
  router.push('/chat')
}

function shake(el: HTMLElement | null): void {
  if (!el) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.fromTo(
    el,
    { x: 0 },
    { x: 7, duration: 0.05, repeat: 5, yoyo: true, clearProps: 'x' }
  )
}
</script>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(420px, 46%) 1fr;
  height: 100vh;
  overflow: hidden;
}

/* ================= 左侧视觉区 ================= */
.visual-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #a5b4fc;
  background:
    radial-gradient(120% 90% at 15% 10%, rgba(79, 70, 229, 0.32), transparent 60%),
    radial-gradient(100% 80% at 85% 90%, rgba(6, 182, 212, 0.26), transparent 60%),
    linear-gradient(160deg, #0b1020 0%, #141b36 45%, #0d1226 100%);
}

.hex-lattice {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpath d='M30 7.5L90 7.5L120 52L90 96.5L30 96.5L0 52Z' fill='none' stroke='%237dd3fc' stroke-width='1'/%3E%3C/svg%3E");
  background-size: 120px 104px;
  opacity: 0.07;
  animation: lattice-drift 60s linear infinite;
}

@keyframes lattice-drift {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 120px 104px;
  }
}

.float-hex {
  position: absolute;
  color: rgba(125, 211, 252, 0.28);
  will-change: transform;
}
.float-hex svg {
  width: 100%;
  height: 100%;
}
.hex-1 {
  width: 90px;
  height: 90px;
  top: 12%;
  left: 8%;
}
.hex-2 {
  width: 56px;
  height: 56px;
  top: 74%;
  left: 14%;
  color: rgba(165, 180, 252, 0.3);
}
.hex-3 {
  width: 40px;
  height: 40px;
  top: 30%;
  right: 9%;
  color: rgba(34, 211, 238, 0.35);
}

.visual-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 48px;
}

.molecule-wrap {
  width: min(340px, 42vw);
  filter: drop-shadow(0 0 34px rgba(34, 211, 238, 0.22));
}
.molecule {
  width: 100%;
  height: auto;
}
.molecule .orbit,
.molecule .nucleus-core,
.molecule .nucleus {
  will-change: transform;
}
.molecule .nucleus-core,
.molecule .nucleus {
  transform-box: fill-box;
  transform-origin: center;
}

.visual-copy {
  text-align: center;
  color: #e2e8f0;
}
.visual-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.42em;
  color: #67e8f9;
  margin-bottom: 10px;
  opacity: 0.85;
}
.visual-title {
  font-size: clamp(30px, 3.4vw, 42px);
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, #7dd3fc 0%, #67e8f9 40%, #a5b4fc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0 0 8px;
}
.visual-sub {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

/* 化学式标签 */
.formula-chip {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(125, 211, 252, 0.65);
  border: 1px solid rgba(34, 211, 238, 0.22);
  background: rgba(15, 23, 42, 0.45);
  border-radius: 999px;
  padding: 5px 12px;
  backdrop-filter: blur(4px);
  will-change: transform;
}
.chip-1 {
  top: 18%;
  right: 14%;
}
.chip-2 {
  top: 62%;
  left: 7%;
}
.chip-3 {
  bottom: 16%;
  right: 20%;
}
.chip-4 {
  top: 44%;
  left: 12%;
}
.chip-5 {
  bottom: 24%;
  left: 30%;
}

/* ================= 右侧表单区 ================= */
.form-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--color-surface);
}

.theme-toggle {
  position: absolute;
  top: 22px;
  right: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}
.theme-toggle:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.theme-toggle svg {
  width: 18px;
  height: 18px;
}

.form-inner {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 34px;
}
.logo-badge {
  width: 46px;
  height: 46px;
}
.logo-badge svg {
  width: 100%;
  height: 100%;
}
.logo-text {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin: 0 0 6px;
}
.login-subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 30px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-field label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 7px;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}
.input-wrap:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
}
.input-wrap > svg {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}
.input-wrap:focus-within > svg {
  color: var(--color-accent);
}
.input-wrap input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13.5px;
  font-family: inherit;
  color: var(--color-text);
}
.input-wrap input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.pwd-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
}
.pwd-toggle:hover {
  color: var(--color-text);
}
.pwd-toggle svg {
  width: 17px;
  height: 17px;
}

.form-error {
  font-size: 12.5px;
  color: var(--color-danger);
  margin: -6px 0 0;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}
.checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.checkbox-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface-alt);
  color: transparent;
  transition: all var(--transition-fast);
}
.checkbox-box svg {
  width: 10px;
  height: 10px;
}
.checkbox input:checked + .checkbox-box {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.forgot-link {
  font-size: 12.5px;
  color: var(--color-accent);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.forgot-link:hover {
  color: var(--color-accent-light);
  text-decoration: underline;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  height: 48px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: linear-gradient(120deg, var(--color-primary) 0%, var(--color-accent) 120%);
  cursor: pointer;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--color-primary) 34%, transparent);
  transition: transform var(--transition-fast), box-shadow var(--transition-normal), filter var(--transition-fast);
}
.login-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--color-primary) 44%, transparent);
  transform: translateY(-1px);
}
.login-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}
.login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}
.btn-spinner {
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.form-footer {
  margin-top: 26px;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.social-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.social-btn:hover {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}
.social-btn svg {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
}

.register-hint {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  margin: 18px 0 0;
}
.register-link {
  color: var(--color-accent);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.register-link:hover {
  color: var(--color-accent-light);
  text-decoration: underline;
}

/* 响应式：窄屏隐藏左侧视觉区 */
@media (max-width: 920px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .visual-panel {
    display: none;
  }
}
</style>
