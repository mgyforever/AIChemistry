import { reactive } from 'vue'

function getInitialTheme(): 'dark' | 'light' {
  return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
}

export const themeStore = reactive({
  mode: getInitialTheme() as 'dark' | 'light',

  toggle(): void {
    this.mode = this.mode === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', this.mode)
    applyTheme(this.mode)
  },

  init(): void {
    applyTheme(this.mode)
  }
})

function applyTheme(mode: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('light', mode === 'light')
}
