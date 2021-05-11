export default async function ({ addon }) {
  var vm = addon.tab.traps.vm;
  var ScratchBlocks = await addon.tab.traps.getBlockly();
  // DOM:
  var tabs = await addon.tab.waitForElement("[class*=gui_tabs]")
  var tabList = await addon.tab.waitForElement("[class*=gui_tab-list]");
  var heading = document.createElement("li");
  heading.classList.add(addon.tab.scratchClass("react-tabs_react-tabs__tab"), addon.tab.scratchClass("gui_tab"));
  heading.id = "react-tabs-9";
  var headingIcon = document.createElement("img");
  headingIcon.src = addon.self.dir+"/icon.svg";
  var headingText = document.createTextNode("Debugger");
  heading.appendChild(headingIcon);
  heading.appendChild(headingText);
  var debugArea = document.createElement("div");
  var debugCanvas = document.createElement("canvas");
  var debugOpcodes = document.createElement("ul");
  debugCanvas.width = 480;
  debugCanvas.height = 360;
  debugOpcodes.id = "opcode-debug";
  debugArea.id = "debugger";
  //debugArea.appendChild(debugCanvas);
  debugArea.appendChild(debugOpcodes);
  tabs.appendChild(debugArea);
  tabList.appendChild(heading);
  function setVisible(visible) {
    if (visible) {
      heading.classList.add(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      debugArea.style.display = "block";
    } else {
      heading.classList.remove(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      debugArea.style.display = "none";
    }
  }
  setVisible(false);
  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", ({ detail }) => {
    if (detail.action.type === "scratch-gui/navigation/ACTIVATE_TAB") {
      setVisible(detail.action.activeTabIndex === 4);
    } else if (detail.action.type === "scratch-gui/mode/SET_PLAYER") {
      if (!detail.action.isPlayerOnly && addon.tab.redux.state.scratchGui.editorTab.activeTabIndex === 4) {
        // DOM doesn't actually exist yet
        setVisible(true);
      }
    }
  });
  heading.addEventListener("click", (e) => {
    addon.tab.redux.dispatch({ type: "scratch-gui/navigation/ACTIVATE_TAB", activeTabIndex: 4 });
  });
  // Profiler:
  const mapOpcodesToScratchblocks = {
    motion_movesteps: (args) => `move (${args.STEPS || 10}) steps`,
    motion_gotoxy: (args) => `go to x: (${args.X || 0}) y: (${args.Y || 0})`,
    motion_goto: (args) => `go to [${args.TO || "..."} v]`,
    motion_turnright: (args) => `turn right (${args.DEGREES || 15}) degrees`,
    motion_turnleft: (args) => `turn left (${args.DEGREES || 15}) degrees`,
    motion_setx: (args) => `set x to (${args.X})`
  }
//  await addon.tab.loadScript(addon.self.lib+"/thirdparty/cs/scratchblocks-v3.5-min.js");
  function renderOpcode (block, args={}) {
    var newBlock = document.createElement("li");
//    newBlock.style.backgroundColor = ScratchBlocks;
    newBlock.innerText = /*mapOpcodesToScratchblocks]*/block/*](args)*/;
    debugOpcodes.appendChild(newBlock);
    //debugOpcodes.innerHTML += "\n"+/*mapOpcodesToScratchblocks[*/block/*](args)*/;
    //scratchblocks.parse("pre#opcode-debug", {inline: false});
  }
  vm.runtime.renderer.setDebugCanvas(debugCanvas);
  vm.runtime.enableProfiling();
  vm.runtime.profiler.onFrame = function ({ id, arg }) {
    if (id === vm.runtime.profiler.idByName("blockFunction")) {
      renderOpcode(arg);
    }
  };
}
