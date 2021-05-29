import BlockRow from "./block-row.js";

export default async function ({ addon, msg }) {
  addon.tab.redux.initialize();
  var vm = addon.tab.traps.vm;
  /*var */window.ScratchBlocks = await addon.tab.traps.getBlockly();
  // DOM:
  // Tab
  var tabs = await addon.tab.waitForElement("[class*=gui_tabs]");
  var tabList = await addon.tab.waitForElement("[class*=gui_tab-list]");
  // Heading
  var heading = document.createElement("li");
  heading.classList.add(addon.tab.scratchClass("react-tabs_react-tabs__tab"), addon.tab.scratchClass("gui_tab"));
  heading.id = "react-tabs-9";
  var headingIcon = document.createElement("img");
  headingIcon.src = addon.self.dir+"/icon.svg";
  var headingText = document.createTextNode("Debugger");
  heading.appendChild(headingIcon);
  heading.appendChild(headingText);
  // Content
  var debugArea = document.createElement("div");
  var debugOpcodes = document.createElement("table");
  debugOpcodes.id = "opcode-debug";
  debugArea.classList.add("sa-debugger", addon.tab.scratchClass("asset-panel_wrapper"));
  // Search box
  var searchBox = document.createElement("span");
  var searchInput = document.createElement("input");
  searchInput.classList.add(addon.tab.scratchClass("input_input-form"), "sa-debug-search");
  // Category
  var radioBox = document.createElement("span");
  // Just in case we're not on the code tab
  var originalWorkspace = await (async () => {
    // Guess where this is from?
    const editorMode = addon.tab.traps._getEditorMode();
    if (!editorMode || editorMode === "embed") throw new Error("Cannot access Blockly on this page");
    const BLOCKS_CLASS = '[class^="gui_blocks-wrapper"]';
    let elem = document.querySelector(BLOCKS_CLASS);
    if (!elem) {
      elem = await addon.tab.traps._waitForElement(BLOCKS_CLASS);
    }
    const internal = elem[addon.tab.traps._react_internal_key];
    let childable = internal;
    /* eslint-disable no-empty */
    while (((childable = childable.child), !childable || !childable.stateNode || !childable.stateNode.ScratchBlocks)) {}
    /* eslint-enable no-empty */
    return childable.stateNode.workspace;
  })();
  originalWorkspace.getFlyout().parentToolbox_.categoryMenu_.categories_.forEach((category) => {
    var newRadio = document.createElement("span");
    newRadio.innerText = ScratchBlocks.utils.replaceMessageReferences(category.name_);
    newRadio.classList.add(
      addon.tab.scratchClass("button_outlined-button"),
      addon.tab.scratchClass("menu-bar_menu-bar-button"),
      addon.tab.scratchClass("community-button_community-button"),
      //addon.tab.scratchClass("sprite-info_radio"),
      "sa-category-select");
    newRadio.style.setProperty("--thisCategoryColor", category.colour_);
    newRadio.onclick = function () {
      newRadio.classList.toggle("deselected-category");
      refreshSearch();
    };
    radioBox.appendChild(newRadio);
  });
  radioBox.classList.add("sa-category-radio-wrapper");
  var clearBtn = document.createElement("span");
  clearBtn.appendChild(document.createTextNode("Clear"));
  clearBtn.classList.add(
    addon.tab.scratchClass("button_outlined-button"),
    addon.tab.scratchClass("menu-bar_menu-bar-button"),
    addon.tab.scratchClass("community-button_community-button"),
    "sa-clear-btn"
  );
  clearBtn.onclick = function () {
    BlockRow.applyToAllBlocks(function (block) {
      block.workspace.dispose();
      block.row.remove();
    });
  }
  // Add to DOM
  searchBox.appendChild(searchInput);
  debugArea.appendChild(searchBox);
  debugArea.appendChild(radioBox);
  debugArea.appendChild(clearBtn);
  debugArea.appendChild(debugOpcodes);
  tabs.appendChild(debugArea);
  tabList.appendChild(heading);
  // VM stuff
  function renderOpcode (block, args={}) {
    var blockArgs = args[0];
    var blockUtils = args[1];
    console.log(blockUtils.thread.peekStack());
    console.log(BlockRow.mostRecentBlock());
    // If the block is the same as before, ignore it
    // For some reason, reporters show uo as the same block, but come before it, so to avoid showing the incorrect opcode etc.
    // we dispose of the first one and replace it with the new one
    if (blockUtils.thread.peekStack() === (BlockRow.mostRecentBlock() || {blockId: null}).blockId) {
      BlockRow.mostRecentBlock().dispose()
    }
    var newBlock = new BlockRow(block, blockArgs, blockUtils, addon.settings);
    newBlock.renderBlock();
  }
  // Profiling is cleaner, but does not give use enough info
  /*vm.runtime.enableProfiling();
  vm.runtime.profiler.onFrame = function ({ id, arg }) {
    if (id === vm.runtime.profiler.idByName("blockFunction")) {
      renderOpcode(arg);
    }
  };*/
  const oldGetOpcodeFunc = vm.runtime.getOpcodeFunction;
  vm.runtime.getOpcodeFunction = function (opcode) {
    return oldGetOpcodeFunc.call(vm.runtime, opcode) === undefined ? undefined : function (...args) {
      renderOpcode(opcode, args);
      oldGetOpcodeFunc.call(vm.runtime, opcode)(...args);
    }
  };
  // Implement searches
  function refreshSearch () {
    var categories = [];
    document.querySelectorAll(".sa-category-select:not(.deselected-category)").forEach((node) => {categories.push(node.textContent)});
    BlockRow.filterBlocks((b) => b.matchesSearch({
      text: searchInput.value,
      caegories: categories
    }));
  }
  searchInput.addEventListener("input", refreshSearch);
  // searchInput.onchange = refreshSearch;
  // Redux:
  function setVisible(visible) {
    if (visible) {
      heading.classList.add(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      debugArea.style.display = "block";
      BlockRow.applyToAllBlocks(
        (b) => {
          b.visible = true;
          b.renderBlock();
        }
      );
      refreshSearch();
    } else {
      heading.classList.remove(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      debugArea.style.display = "none";
      BlockRow.applyToAllBlocks(
        (b) => {
          b.visible = false;
          b.renderBlock();
        }
      );
    }
  }
  setVisible(false);
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
}