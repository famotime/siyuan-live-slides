<template>
  <div class="spm-presenter-tab">
    <!-- 演讲者控制台：内嵌插件静态 presenter.html，与预览沙箱同源同会话，
         BroadcastChannel("siyuan-slidev-sync") 可直接互通实现双屏同步 -->
    <iframe
      class="spm-presenter-tab__iframe"
      src="/plugins/siyuan-slidev/slidev-client/presenter.html"
      frameborder="0"
      allow="fullscreen; autoplay"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
// 纯承载容器：数据同步完全由 presenter.html 内部的 BroadcastChannel 协议自治完成
</script>

<style scoped>
.spm-presenter-tab {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--b3-theme-background, #0f1117);
}

.spm-presenter-tab__iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
</style>
