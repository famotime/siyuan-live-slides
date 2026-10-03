<template>
  <div class="plugin-app-main">

    <div class="demo">
      <!-- Show text in siyuan at center -->
      <div>Hello Siyuan.</div>


      <div>
        Use Siyuan Style components
      </div>
      <div class="row">
        Checkbox:
        <SyCheckbox
          v-model="isChecked"
        />
        ({{ isChecked ? 'checked' : 'unchecked' }})
      </div>
      <div class="row">
        <SyIcon
          name="iconSamplePlugin"
        />
        <SyIcon
          name="iconSamplePlugin"
          size="20px"
        />
        <SyIcon
          name="iconSamplePlugin"
          size="30px"
        />
      </div>
      <div class="col">
        <SyInput
          v-model="inputValue"
        />
        <div>
          {{ inputValue }}
        </div>
      </div>
      <div class="col">
        <SySelect
          v-model="selectValue"
          :options="selectOptions"
        />
        <div>
          selected value: {{ selectValue }}
        </div>
        <div>
          selected text: {{ selectOptions.find(option => option.value === selectValue)?.text }}
        </div>
      </div>

      <div class="col">
        <SyTextarea
          v-model="textareaValue"
        />
        <div>
          {{ textareaValue }}
        </div>
      </div>
      <SyButton
        @click="showAllValues"
      >
        Show All Values
      </SyButton>
      <SyButton
        @click="openSetting"
      >
        Open Setting
      </SyButton>

      <Teleport
        v-if="statusRef"
        :to="statusRef"
      >
        <SyIcon
          name="iconSamplePlugin"
          style="color: currentColor;"
        />
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import {
  onMounted,
  ref,
} from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SyCheckbox from '@/components/SiyuanTheme/SyCheckbox.vue'
import SyIcon from '@/components/SiyuanTheme/SyIcon.vue'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue'
import { usePlugin } from '@/main'


const isChecked = ref(false)

const inputValue = ref('')

const selectValue = ref()
const selectOptions = ref([
  {
    value: '1',
    text: 'Option 1',
  },
  {
    value: '2',
    text: 'Option 2',
  },
  {
    value: '3',
    text: 'Option 3',
  },
])

const textareaValue = ref('')

const showAllValues = () => {
  showMessage(`isChecked: ${isChecked.value}, inputValue: ${inputValue.value}, selectValue: ${selectValue.value}, textareaValue: ${textareaValue.value}`)
}

const openSetting = () => {
  showMessage('Need open plugin setting.')
}

const plugin = usePlugin()

// 添加顶栏按钮（使用注册的专属 SVG 图标）
plugin.addTopBar({
  icon: 'iconSamplePlugin',
  title: 'Plugin Sample',
  callback: () => {
    showMessage('Hello Siyuan.')
  },
})

const statusRef = ref<HTMLDivElement>()

// 两种添加状态栏的方式
onMounted(() => {
  // 1. Vue Teleport 方式挂载状态栏
  const status = document.getElementById('status') as HTMLDivElement
  if (status) {
    setTimeout(() => {
      statusRef.value = status
    }, 5000)
  }

  // 2. 使用思源插件 API addStatusBar
  const tempStatus = document.createElement('div')
  tempStatus.classList.add('temp-status')
  tempStatus.innerHTML = `
    <svg style="width: 12px; height: 12px; color: currentColor;">
      <use xlink:href="#iconSamplePlugin"></use>
    </svg>
  `

  plugin.addStatusBar({
    element: tempStatus,
    position: 'right',
  })
})
</script>


<!-- 局部样式 -->
<style lang="scss" scoped>
.plugin-app-main {
  width: 100%;
  height: 100%;
  max-height: 100vh;
  box-sizing: border-box;
  pointer-events: none;

  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;

  .demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    pointer-events: auto;

    z-index: 10;

    background-color: var(--b3-theme-surface);
    border-radius: var(--b3-border-radius);
    border: 1px solid var(--b3-border-color);
    padding: 16px;
  }
}
</style>

<!-- 全局样式 -->
<style lang="scss">
.plugin-sample-vite-vue-app {
  width: 100vw;
  height: 100dvh;
  max-height: 100vh;
  position: absolute;
  top: 0px;
  left: 0px;
  pointer-events: none;
  box-sizing: border-box;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
</style>
