export default async function ({ addon }) {
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
  var debugCanvas = document.createElement("canvas");
  var debugOpcodes = document.createElement("table");
  debugCanvas.width = 480;
  debugCanvas.height = 360;
  debugOpcodes.id = "opcode-debug";
  debugArea.classList.add("sa-debugger", addon.tab.scratchClass("asset-panel_wrapper"));
  // Search box
  var searchBox = document.createElement("span");
  var searchInput = document.createElement("input");
  searchInput.classList.add(addon.tab.scratchClass("input_input-form"), "sa-debug-search");
  // Category
  var radioBox = document.createElement("span");
  // Should still be Code tab
  ScratchBlocks.getMainWorkspace()
    .getFlyout().parentToolbox_.categoryMenu_.categories_.forEach((category) => {
    var newRadioButton = document.createElement("input");
    newRadioButton.type = "radio";
    newRadioButton.name = "category";
    newRadioButton.value = ScratchBlocks.utils.replaceMessageReferences(category.name_);
    newRadioButton.addEventListener("input", (e)=>console.log(this.value, e));
    newRadioButton.classList.add("sa-hidden-radio");
    var newRadioLabel = document.createElement("label");
    newRadioLabel.innerText = newRadioButton.value;
    newRadioLabel.classList.add(addon.tab.scratchClass("sprite-info_radio"), "sa-category-radio");
    newRadioLabel.style.setProperty("--thisCategoryColor");
    var newRadio = document.createElement("span");
    newRadio.appendChild(newRadioButton);
    newRadio.appendChild(newRadioLabel);
    radioBox.appendChild(newRadio);
  });
  radioBox.classList.add(addon.tab.scratchClass("sprite-info_radio-wrapper"));
  // Add to DOM
  //debugArea.appendChild(debugCanvas);
  searchBox.appendChild(searchInput);
  debugArea.appendChild(searchBox);
  debugArea.appendChild(radioBox);
  debugArea.appendChild(debugOpcodes);
  tabs.appendChild(debugArea);
  tabList.appendChild(heading);
  // Profiler:
  class BlockRow {
    // Keep track of blocks
    static allBlocks = [];
    static applyToAllBlocks (func) {
      BlockRow.allBlocks.forEach(func)
    }
    static filterBlocks (func) {
      BlockRow.applyToAllBlocks(function (block) {
        block.visible = func(block);
        block.renderBlock();
      });
    }
    constructor (opcode, args) {
      BlockRow.allBlocks.push(this);
      this.opcode = opcode;
      this.args = args;
      this.visible = true;
      this.initRender();
    }
    initRender () {
      this.row = document.createElement("tr");
      this.DOMWorkspace = document.createElement("td");
      this.row.appendChild(this.DOMWorkspace);
      debugOpcodes.appendChild(this.row);
      this.workspace = new ScratchBlocks.inject(this.DOMWorkspace, {
        comments: false,
        toolbox: false,
        trashcan: false,
        readOnly: true,
        scrollbars: false,
        zoom: false
      });
      this.blocklyBlock = this.workspace.newBlock(this.opcode);
      this.blocklyBlock.initSvg();
      // Set media path (or the images dont render)
      this.workspace.options.pathToMedia = "/static/blocks-media/";
      // Remove background colors and borders
      this.workspace.svgBackground_.style.fill = "#FFFFFF";
      this.workspace.svgBackground_.style.strokeWidth = "0";
      this.renderBlock();
    }
    renderBlock () {
      if (this.visible) {
        this.workspace.setVisible(true);
        this.workspace.render();
      } else {
        this.workspace.setVisible(false);
      }
      this.metrics();
      ScratchBlocks.svgResize(this.workspace);
    }
    metrics () {
      var metrics = this.workspace.getMetrics();
      if (!this.visible) metrics = {contentHeight: 0, contentWidth: 0};
      this.DOMWorkspace.style.height = metrics.contentHeight + "px";
      this.DOMWorkspace.style.width = /*"100%";*/metrics.contentWidth + "px";
    }
    getBlockText () {
      return this.workspace.svgGroup_.textContent;
    }
    addInputs () {
      // Work on this
    }
    textSearchMatch (text) {
      // The workspace textContent returns the text in the block but with no spaces
      var splitText = text.split(" ");
      var match = 0;
      splitText.forEach((word) => {
        if (this.getBlockText().includes(word)) match++;
      });
      return match;
    }
    matchesSearch (searchQueries) {
      var matches = (
        (this.opcode.split("_")[0] || "").toLowerCase() === (searchQueries.category || "").toLowerCase() ||
        this.textSearchMatch(searchQueries.text) > 0
      );
      console.log(matches);
      return matches;
    }
  }
  function renderOpcode (block, args={}) {
    var newBlock = new BlockRow(block, args);
    newBlock.renderBlock();/*
    var newBlockRow = document.createElement("tr");
    var newBlock = document.createElement("td");
    newBlockRow.appendChild(newBlock)
;    debugOpcodes.appendChild(newBlockRow);
    var newWorkspace = ScratchBlocks.inject(newBlock, {
      comments: false,
      toolbox: false,
      trashcan: false,
      readOnly: true,
      scrollbars: false,
      zoom: false
    });
    var newBlocklyBlock = newWorkspace.newBlock(block);
    newBlocklyBlock.initSvg();
    newWorkspace.render();
    var metrics = newWorkspace.getMetrics();
    newBlock.style.height = metrics.contentHeight + "px";
    newBlock.style.width = metrics.contentWidth + "px";
    ScratchBlocks.svgResize(newWorkspace);*/
  }
  vm.runtime.renderer.setDebugCanvas(debugCanvas);
  vm.runtime.enableProfiling();
  vm.runtime.profiler.onFrame = function ({ id, arg }) {
    if (id === vm.runtime.profiler.idByName("blockFunction")) {
      renderOpcode(arg);
    }
  };
  // Implement searches
  function refreshSearch () {
    BlockRow.filterBlocks((b) => b.matchesSearch({text: searchInput.value}));
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
}