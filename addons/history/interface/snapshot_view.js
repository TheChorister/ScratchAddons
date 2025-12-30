class SpriteView {
  constructor(snapshot_view) {
    this.snapshot_view = snapshot_view;
    this.element = null;
  }

  buildSkeleton(scratchClass) {
    this.element = document.createElement("div");
    this.element.classList.add("sa-history-snapshot-sprite-view");
    this.element.innerHTML = `
        <h4>Sprite1</h4>
        <div class="${scratchClass("sprite-info_sprite-info")} ${scratchClass("box_box")}">
   <div class="${scratchClass("sprite-info_row")} ${scratchClass("sprite-info_row-primary")}">
      <div class="${scratchClass("sprite-info_group")}">
      <label class="${scratchClass("label_input-group")}">
      <span class="${scratchClass("label_input-label")}">
      <span>Sprite</span>
      </span>
      <input
      disabled
      class="${scratchClass("input_input-form")} ${scratchClass("sprite-info_sprite-input")}"
      placeholder="Name" tabindex="0" type="text" value="Sprite1">
      </label>
      </div>
      <div class="${scratchClass("sprite-info_group")}">
      <label class="${scratchClass("label_input-group")}">
      <span class="${scratchClass("label_input-label")}">x</span>
      <input disabled placeholder="x" tabindex="0" type="text"
      class="${scratchClass("input_input-form")} ${scratchClass("input_input-small")}"
      value="0">
      </label>
      </div>
      <div class="${scratchClass("sprite-info_group")}">
      <label class="${scratchClass("label_input-group")}">
      <span class="${scratchClass("label_input-label")}">y</span>
      <input disabled placeholder="y" tabindex="0" type="text"
      class="${scratchClass("input_input-form")} ${scratchClass("input_input-small")}" value="0"></label></div>
   </div>
   <div class="${scratchClass("sprite-info_row")}">
      <div class="${scratchClass("sprite-info_group")}">
         <div class="${scratchClass("toggle-buttons_row")}">
         <button
           class="${scratchClass("toggle-buttons_button")}"
           title="Show sprite"
           aria-label="Show sprite"
           aria-pressed="true">
           <img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+Cjxzdmcgd2lkdGg9IjE2cHgiIGhlaWdodD0iMTZweCIgdmlld0JveD0iMCAwIDE2IDE2IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogICAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA0My4yICgzOTA2OSkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgICA8dGl0bGU+c2hvdy1pY29uLWFjdGl2ZTwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxkZWZzPjwvZGVmcz4KICAgIDxnIGlkPSJQYWdlLTEiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPgogICAgICAgIDxnIGlkPSJzaG93LWljb24tYWN0aXZlIiBmaWxsLXJ1bGU9Im5vbnplcm8iIGZpbGw9IiM4NTVDRDYiPgogICAgICAgICAgICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxLjAwMDAwMCwgMi4wMDAwMDApIj4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xMy41MDkxMjk1LDQuMzY0NzA5ODcgQzE0LjE1MDUxOTUsNS4yNjc4NTU2NiAxNC4xNzY1OTc2LDYuNzUzMjE5MjUgMTMuNTA5MTI5NSw3LjYzNTI5MDA5IEMxMy41MDkxMjk1LDcuNjM1MjkwMDkgMTEuNDc0NDQwMSwxMS41IDYuOTk5OTk5OTksMTEuNSBDMi41MjU1NTk4NiwxMS41IDAuNDkwODcwNDQsNy42MzUyOTAwOSAwLjQ5MDg3MDQ0LDcuNjM1MjkwMDkgQy0wLjE1MDUxOTUxOCw2LjczMjE0NDMgLTAuMTc2NTk3NTcxLDUuMjQ2NzgwNzEgMC40OTA4NzA0NCw0LjM2NDcwOTg3IEMwLjQ5MDg3MDQ0LDQuMzY0NzA5ODcgMi41MjU1NTk4NiwwLjUgNi45OTk5OTk5OSwwLjUgQzExLjQ3NDQ0MDEsMC41IDEzLjUwOTEyOTUsNC4zNjQ3MDk4NyAxMy41MDkxMjk1LDQuMzY0NzA5ODcgWiBNNi45OTg4OTQxMiw5Ljk5ODg5NDEyIEM5LjIwNzcyNzcsOS45OTg4OTQxMiAxMC45OTgzNDEyLDguMjA4MjgwNjggMTAuOTk4MzQxMiw1Ljk5OTQ0NzA2IEMxMC45OTgzNDEyLDMuNzkwNjEzNDQgOS4yMDc3Mjc3LDIgNi45OTg4OTQxMiwyIEM0Ljc5MDA2MDUsMiAyLjk5OTQ0NzA2LDMuNzkwNjEzNDQgMi45OTk0NDcwNiw1Ljk5OTQ0NzA2IEMyLjk5OTQ0NzA2LDguMjA4MjgwNjggNC43OTAwNjA1LDkuOTk4ODk0MTIgNi45OTg4OTQxMiw5Ljk5ODg5NDEyIFoiIGlkPSJDb21iaW5lZC1TaGFwZSI+PC9wYXRoPgogICAgICAgICAgICAgICAgPGNpcmNsZSBpZD0iT3ZhbCIgY3g9IjciIGN5PSI2IiByPSIyIj48L2NpcmNsZT4KICAgICAgICAgICAgPC9nPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg=="
           aria-hidden="true">
           </button>
           <button class="${scratchClass("toggle-buttons_button")}" title="Hide sprite"
           aria-label="Hide sprite"
           aria-pressed="false">
           <img src="/static/assets/947a6530bad18e5d96fe3d3433f2f937.svg"
           aria-hidden="true">
           </button></div>
      </div>
      <div class="${scratchClass("sprite-info_group")} ${scratchClass("sprite-info_larger-input")}">
      <label class="${scratchClass("label_input-group")}">
      <span class="${scratchClass("label_input-label-secondary")}">
      <span>Size</span>
      </span>
      <input disabled label="[object Object]" tabindex="0" type="text"
      class="${scratchClass("input_input-form")} ${scratchClass("input_input-small")}"
      value="100"></label></div>
      <div
      class="${scratchClass("sprite-info_group")} ${scratchClass("sprite-info_larger-input")}">
      <label class="${scratchClass("label_input-group")}">
      <span class="${scratchClass("label_input-label-secondary")}">
      <span>Direction</span>
      </span>
      <input disabled label="[object Object]" tabindex="0" type="text"
      class="${scratchClass("input_input-form")} ${scratchClass("input_input-small")}"
      value="0"></label></div>
   </div>
</div>
        `;
  }

  loadsnapshot(snapshot) {
    var target = snapshot.clones.find((c) => c.isOriginal);
    this.element.querySelector("h4").textContent = snapshot.name;
    this.element.children[1].children[0].children[0].children[0].children[1].value = snapshot.name;
    this.element.children[1].children[0].children[1].children[0].children[1].value = target.x;
    this.element.children[1].children[0].children[2].children[0].children[1].value = target.y;
    var showHides = this.element.children[1].children[1].children[0].children[0].children;
    showHides[0].setAttribute("aria-pressed", target.visible);
    showHides[1].setAttribute("aria-pressed", !target.visible);
    this.element.children[1].children[1].children[1].children[0].children[1].value = target.size;
    this.element.children[1].children[1].children[2].children[0].children[1].value = target.direction;
  }

  mount() {
    this.snapshot_view.element.children[1].appendChild(this.element);
  }
}

class SnapshotView {
  constructor(parent) {
    this.parent = parent;
    this.element = null;
    this.snapshot = null;
  }

  buildSkeleton() {
    this.element = document.createElement("div");
    this.element.classList.add("sa-history-snapshot-view");
    // I'm only doing this for convenience
    // This only being done as it's a literal - I'm not taking it from anywhere
    this.element.innerHTML = `
        <h2>Snapshot</h2>
        <details class="sa-history-detail">
        <summary><h4>Sprites</h4></summary>
        </details>
        <details class="sa-history-detail">
        <summary><h4>Threads</h4></summary>
        </details>
        `;
  }

  loadsnapshot(snapshot, scratchClass) {
    if (snapshot.name) {
      this.element.children[0].textContent = snapshot.name;
    }
    for (let sprite in snapshot.runtime.sprites) {
      let view = new SpriteView(this);
      view.buildSkeleton(scratchClass);
      view.loadsnapshot(sprite);
      view.mount();
    }
  }

  mount() {
    this.parent.appendChild(this.element);
  }
}

export { SnapshotView as default };
