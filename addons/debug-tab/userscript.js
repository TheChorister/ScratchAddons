export default async function ({ addon }) {
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
  var originalWorkspace = await (async () => {
    // Guess where this is from?
    const editorMode = addon.tab.traps._getEditorMode();
    if (!editorMode || editorMode === "embed") throw new Error("Cannot access Blockly on this page");
    const BLOCKS_CLASS = '[class^="gui_blocks-wrapper"]';
    let elem = document.querySelector(BLOCKS_CLASS);
    if (!elem) {
      elem = await this._waitForElement(BLOCKS_CLASS);
    }
    const internal = elem[addon.tab.traps._react_internal_key];
    let childable = internal;
    /* eslint-disable no-empty */
    while (((childable = childable.child), !childable || !childable.stateNode || !childable.stateNode.ScratchBlocks)) {}
    /* eslint-enable no-empty */
    return childable.stateNode.workspace;
  })(addon.tab.traps);
  originalWorkspace.getFlyout().parentToolbox_.categoryMenu_.categories_.forEach((category) => {
    var newRadioButton = document.createElement("input");
    newRadioButton.type = "checkbox";
    newRadioButton.name = "category";
    newRadioButton.value = category.id_;
    newRadioButton.addEventListener("input", (e)=>console.log(this.value, e));
    newRadioButton.classList.add("sa-hidden-radio");
    var newRadioLabel = document.createElement("label");
    newRadioLabel.innerText = ScratchBlocks.utils.replaceMessageReferences(category.name_);
    newRadioLabel.classList.add(addon.tab.scratchClass("sprite-info_radio"), "sa-category-radio");
    newRadioLabel.style.setProperty("--thisCategoryColor", category.colour_);
    newRadioLabel.style.filter = " ";
    newRadioLabel.style.webkitFilter = " ";
    var newRadio = document.createElement("span");
    newRadio.appendChild(newRadioButton);
    newRadio.appendChild(newRadioLabel);
    radioBox.appendChild(newRadio);
  });
  radioBox.classList.add(addon.tab.scratchClass("sprite-info_radio-wrapper"), "sa-category-radio-wrapper");
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
    constructor (opcode, args, blockUtils, proccode="") {
      BlockRow.allBlocks.push(this);
      this.opcode = opcode;
      this.category = opcode.split("_")[0];
      this.args = args;
      this.utils = blockUtils;
      this.procCode = proccode;
      this.visible = true;
      this.rendered = false;
      this.xml = this.generateBlockXML();
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
      this.blocklyBlock = ScratchBlocks.Xml.domToBlock(ScratchBlocks.Xml.textToDom(this.xml), this.workspace);
      this.blocklyBlock.procCode_ = this.procCode === "" ? undefined : this.procCode;
      // Update the custom block text
      if (this.blocklyBlock.updateDisplay_) {
        this.blocklyBlock.updateDisplay_();
      }
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
      this.metrics("content");
      this.metrics("view");
      this.rendered = true;
    }
    metrics (use="content") {
      var metrics = this.workspace.getMetrics();
      if (!this.visible) metrics = {viewHeight: 0, viewWidth: 0, contentHeight: 0, contentWidth: 0};
      this.DOMWorkspace.style.height = this.visible ? "68px" : "0";//metrics[use + "Height"] + "px";
      this.DOMWorkspace.style.width = metrics[use + "Width"] + "px";
      ScratchBlocks.svgResize(this.workspace);
      // For some reason hats are offset up 20 pixels
      if (this.blocklyBlock.startHat_) this.workspace.svgBlockCanvas_.style.transform = "translate(0,20px) scale(1)"; 
    }
    getBlockText () {
      return this.blocklyBlock.toString();
    }
    generateCategoryInfo () {
      const categoryId = this.category;
      var category = originalWorkspace.getFlyout().parentToolbox_.categoryMenu_.categories_.find((category)=>category.id_ === categoryId);
      if (!category) return;
      var categoryInfo = {};
      categoryInfo.id = category.id_;
      categoryInfo.name = ScratchBlocks.utils.replaceMessageReferences(category.name_);
      categoryInfo.color1 = category.colour_;
      categoryInfo.color2 = category.secondaryColour_;
      // The categories don't yet tell use the tertiary colour
      categoryInfo.color3 = category.secondaryColour_;
      categoryInfo.blockIconURI = category.iconURI_;
      categoryInfo.blocks = [];
      categoryInfo.menus = [];
      return categoryInfo;
    }
    generateBlockInfo (categoryInfo) {
      var blockInfo = {};
      // Remove the
      blockInfo.opcode = this.opcode.split("_").splice(0, 1).join("_");
      blockInfo.text = this.generateInputString();
      var blockJSON;
      ScratchBlocks.Blocks[this.opcode].init.call({jsonInit: (args) => blockJSON = args});
      if (blockJSON.outputShape === 3 && blockJSON.previousStatement === null) {
        blockInfo.blockType = "command";
      } else if (blockJSON.output === "String" && blockJSON.outputShape === 2) {
        blockInfo.blockType = "reporter";
      } else if (blockJSON.output === "Boolean" && blockJSON.outputShape === 1) {
        blockInfo.blockType = "Boolean";
      } else if (blockJSON.nextStatement === "String" && blockJSON.outputShape === 3) {
        blockInfo.blockType = "event";
      } else if (blockJSON.branchCount && blockJSON.outputShape === 3 && blockJSON.previousStatement === null) {
        blockInfo.blockType = "command";
      } else if (blockJSON.extensions.includes("shape_hat")) {
        blockInfo.blockType = "hat";
      } else {
        blockInfo.blockType = "conditional";
      }
      // For some readon the find function doesn't work on the ArgumenType Object
      function objectToArray (object) {
        var array = new Array();
        for (let key in object) {
          array[key] = object[key];
        }
        return array;
      }
      const ArgumentTypes = objectToArray({
        ANGLE: "angle",
        BOOLEAN: "Boolean",
        COLOR: "color",
        NUMBER: "number",
        STRING: "string",
        MATRIX: "matrix",
        NOTE: "note",
        IMAGE: "image"
      });
      blockInfo.arguments = {};
      for (let arg in this.args) {
        blockInfo.arguments[arg] = {};
        let argsForBlockly = [];
        // Just in case it has arguments like args1 or args2 as well as args0
        for (let argname in blockJSON) {
          let argument = blockJSON[argname];
          if (argname.startsWith("arg")) {
            //argument.forEach((blockArg, key) => argsForBlockly[key] = blockArg)
            for (let key in argument) {
              argsForBlockly[key] = argument[key];
            }
          }
        };
        if (argsForBlockly.find((arg) => arg.type.includes("dropdown"))) {
          categoryInfo.menus[arg] = {};
          categoryInfo.menus[arg].items = [];
          categoryInfo.menus[arg].items.push(
            {
              text: blockJSON.args0.find((argument) => {
                argument.type.includes("dropdown")
              }).options.find(
                (option) => option[1] === this.args[arg]
              )[0],
              value: blockJSON.args0.find((argument) => {
                argument.type.includes("dropdown")
              }).options.find(
                (option) => option[1] === this.args[arg]
              )[1]
            }
          );
        }
        blockInfo.arguments[arg].type = ArgumentTypes.find((argType) => 
         {
           const argBlockly = argsForBlockly.find(
             (argument) => {
               argument.name === arg
              }
            );
            return argBlockly.type.toLowerCase().includes(argType.toLowerCase()) || argBlockly.check.toLowerCase().includes(argType.toLowerCase())
          });
        blockInfo.arguments[arg].defaultValue = this.args[arg];
      }
      return blockInfo;
    }
    // Based on https://github.com/LLK/scratch-blocks/blob/develop/core/block.js#L1185
    blockToString (block) {
      var text = [];
      if (block.collapsed_) {
        text.push(block.getInput('_TEMP_COLLAPSED_INPUT').fieldRow[0].text_);
      } else {
        for (var i = 0, input; input = block.inputList[i]; i++) {
          for (var j = 0, field; field = input.fieldRow[j]; j++) {
            if (field instanceof ScratchBlocks.FieldDropdown && !field.getValue()) {
              text.push(field.name ? `[${field.name}]` : "");
            } else {
              text.push(field.getText());
            }
          }
          if (input.connection) {
            var child = input.connection.targetBlock();
            if (child) {
              text.push(this.blockToString(child));
            } else {
              text.push(field.name ? `[${field.name}]` : "");
            }
          }
        }
      }
      return text.join(" ");
    }
    generateInputString () {
      return this.blockToString(this.blocklyBlock);
    }
    generateBlockXML () {
      return vm.runtime._convertBlockForScratchBlocks(this.generateBlockInfo(), this.generateCategoryInfo()).xml;
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
    var blockArgs = args[0];
    var blockUtils = args[1];
    const proccode = blockArgs.mutation ? blockArgs.mutation.proccode : null;
    console.log(block);
    console.log(args);
    var newBlock = new BlockRow(block, blockArgs, blockUtils, proccode);
    newBlock.renderBlock();
  }
  vm.runtime.renderer.setDebugCanvas(debugCanvas);
  // Profiling is cleaner, but does not give use enough info
  /*vm.runtime.enableProfiling();
  vm.runtime.profiler.onFrame = function ({ id, arg }) {
    if (id === vm.runtime.profiler.idByName("blockFunction")) {
      renderOpcode(arg);
    }
  };*/
  //vm.runtime._primitives.forEach((func, opcode) => {
  /*for (let opcode in vm.runtime._primitives) {
    let func = vm.runtime._primitives[opcode];
    const oldFunc = func;
    vm.runtime._primitives[opcode] = function (args, utils) {
      renderOpcode(opcode, args, (args.mutation || {proccode: {value: ""}}).proccode.value);
      console.log(args,opcode);
      oldFunc.bind(this, args, opcode);
    };
  }*/
  const oldGetOpcodeFunc = vm.runtime.getOpcodeFunction;
  vm.runtime.getOpcodeFunction = function (opcode) {
    const proper = oldGetOpcodeFunc.call(vm.runtime, opcode);
    return proper === undefined ? undefined : function (...args) {
      renderOpcode(opcode, args);
      proper(...args);
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