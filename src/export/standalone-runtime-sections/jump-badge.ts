/**
 * 「数字+回车」跳页角标状态机
 */
export function getJumpBadgeSection(): string {
  return `      function hideJumpIndicator() {
        jumpDisplay = "";
        jumpInvalid = false;
        jumpBadge.style.display = "none";
        jumpBadge.classList.remove("is-invalid");
        if (jumpIdleTimer) { clearTimeout(jumpIdleTimer); jumpIdleTimer = null; }
        if (jumpFlashTimer) { clearTimeout(jumpFlashTimer); jumpFlashTimer = null; }
      }

      function renderJumpBadge() {
        jumpBadge.textContent = jumpDisplay;
        jumpBadge.style.display = jumpDisplay ? "block" : "none";
        jumpBadge.classList.toggle("is-invalid", jumpInvalid);
      }

      function armJumpIdleTimer() {
        if (jumpIdleTimer) clearTimeout(jumpIdleTimer);
        jumpIdleTimer = setTimeout(hideJumpIndicator, 1500);
      }

      function flashJumpInvalid() {
        if (jumpIdleTimer) { clearTimeout(jumpIdleTimer); jumpIdleTimer = null; }
        jumpInvalid = true;
        renderJumpBadge();
        if (jumpFlashTimer) clearTimeout(jumpFlashTimer);
        jumpFlashTimer = setTimeout(hideJumpIndicator, 500);
      }

      function isEditableKeyTarget(t) {
        if (!t || !t.tagName) return false;
        return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable === true;
      }

`;
}
