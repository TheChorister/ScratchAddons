export default async function ({ addon, global, console }) {
  var ScratchBlocks = await addon.tab.traps.getBlockly();
  var btn;
  var domItems = {
    stage: await addon.tab.waitForElement("[class^=gui_stage-and-target-wrapper]"),
    injectionDiv: await addon.tab.waitForElement(".injectionDiv"),
    blocklySvg: await addon.tab.waitForElement(".blocklySvg"),
    stageHeader: await addon.tab.waitForElement("[class^=controls_controls-container]"),
    tabArea: await addon.tab.waitForElement("[class^=gui_tabs]")
  };
  var resizeBlockly = addon.settings.get("resize-mode") || true;
  var stageShown = true;
  if (resizeBlockly) {
    domItems.stage.classList.add("noResizeBlockly");
    const originalWorkspaceWidth = domItems.injectionDiv.style.width;
  }
  else {
    const originalWorkspaceWidth = "119rem";
  }
  const update = () => {
    btn.src = `${addon.self.dir}/${stageShown ? "show" : "hidden"}.svg`;
    //domItems.tabArea.style.width = "1922px";
    //domItems.stage.style.transform = `translate(${stageShown ? domItems.stage.style.width : "0px"}, 0px)`;
    console.log(btn)
  };
  const resizeWorkspace = (workspace, newWidth) => {
    domItems.injectionDiv.style.width = newWidth;
    domItems.blocklySvg.style.width = newWidth;
    domItems.tabArea.style.width = newWidth;
    ScratchBlocks.svgResize(workspace);
  };
  const hideStage = () => {
    resizeWorkspace(Blockly.getMainWorkspace(), "119rem");
    domItems.stage.classList.add("hidden");
    stageShown = false;
    update();
  };
  const showStage = () => {
    resizeWorkspace(Blockly.getMainWorkspace(), originalWorkspaceWidth);
    domItems.stage.classList.remove("hidden");
    stageShown = true;
    update();
  };
  const toggleStage = () => {
    if (stageShown) {
      hideStage();
    }
    else {
      showStage();
    }
  };
  const init = () => {
    btn = document.createElement("img");
    if (/*addon.settings.get("mode") === "onclick"*/true) {
      btn.onclick = toggleStage;
    }
    else {
      btn.onmouseenter = showStage;
      domItems.stage.onmouseleave = hideStage;
    }
    btn.id = "hideStage";
    showStage();
    domItems.stageHeader.insertBefore(btn, domItems.stageHeader.childNodes[0]);
  };
  init();
}
