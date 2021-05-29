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
    static mostRecentBlock () {
      // No blocks have run yet
      if (BlockRow.allBlocks.length < 1) {
        return undefined;
      }
      return BlockRow.allBlocks[BlockRow.allBlocks.length - 1];
    }
    constructor (opcode, args, blockUtils, settings) {
      this.opcode = opcode;
      this.args = args;
      this.utils = blockUtils;
      this.blockId = this.utils.thread.peekStack();
      this.visible = true;
      this.rendered = false;
      this.settings = settings;
      this.blockJson;
      // A hack to get the block info
      ScratchBlocks.Blocks[this.opcode].init.call({jsonInit: (json) => this.blockJson = json});
      this.category = blockJson.category;
      this.xml = this.generateBlockXML();
      this.initRender();
      BlockRow.allBlocks.push(this);
    }
    initBlock () {
        this.workspace = new ScratchBlocks.inject(this.domRowItems.DOMWorkspace, {
          comments: false,
          toolbox: false,
          trashcan: false,
          readOnly: true,
          scrollbars: false,
          zoom: false
        });
        this.blocklyBlock = ScratchBlocks.Xml.domToBlock(this.xml, this.workspace);
        this.blocklyBlock.initSvg();
        // Set media path (or the images dont render)
        this.workspace.options.pathToMedia = "/static/blocks-media/";
        // Remove background colors and borders
        this.workspace.svgBackground_.style.fill = "#FFFFFF";
        this.workspace.svgBackground_.style.strokeWidth = "0";
        this.renderBlock();
    }
    initRender () {
      this.row = document.createElement("tr");
      document.querySelector("#opcode-debug").appendChild(this.row);
      this.domRowItems = Object.create(null);
      if (this.settings.get("blockSvg")) {
        this.domRowItems.DOMWorkspace = document.createElement("td");
      }
      if (this.settings.get("opcode")) {
        this.domRowItems.opcode = document.createElement("td");
        this.domRowItems.opcode.appendChild(document.createTextNode(this.opcode));
        this.domRowItems.opcode.classList.add("sa-table-text");
      }
      if (this.settings.get("blockId")) {
        this.domRowItems.blockId = document.createElement("td");
        this.domRowItems.blockId.appendChild(document.createTextNode(this.blockId));
        this.domRowItems.blockId.classList.add("sa-table-text");
      }
      if (this.settings.get("jsonArgs")) {
        this.domRowItems.jsonArgs = document.createElement("td");
        this.domRowItems.jsonArgs.appendChild(document.createTextNode(JSON.stringify(this.args)));
        this.domRowItems.jsonArgs.classList.add("sa-table-text");
      }
      if (this.settings.get("category")) {
        this.domRowItems.category = document.createElement("td");
        this.domRowItems.category.appendChild(document.createTextNode(ScratchBlocks.utils.replaceMessageReferences(this.category)));
        this.domRowItems.category.classList.add("sa-table-text");
      }
      if (this.settings.get("timestamp")) {
        this.domRowItems.timestamp = document.createElement("td");
        this.domRowItems.timestamp.appendChild(document.createTextNode(new Date()));
        this.domRowItems.timestamp.classList.add("sa-table-text");
      }
      for (let itemName in this.domRowItems) {
          this.row.appendChild(this.domRowItems[itemName]);
          // Blockly only wants to be injected after the dom has loaded
          if (itemName === "DOMWorkspace") this.initBlock();
      }
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
      this.domRowItems.DOMWorkspace.style.height = metrics[use + "Height"] + 20 + "px";
      this.domRowItems.DOMWorkspace.style.width = metrics[use + "Width"] + "px";
      ScratchBlocks.svgResize(this.workspace);
      // For some reason hats are offset up 20 pixels
      if (this.blocklyBlock.startHat_) this.workspace.svgBlockCanvas_.style.transform = "translate(0,20px) scale(1)"; 
    }
    getBlockText () {
      return this.blocklyBlock.toString();
    }
    generateBlockXML () {
      var xml = ScratchBlocks.Xml.textToDom(this.utils.thread.target.blocks.blockToXML(this.blockId));
      // We don't want to include the next blocks (it gets very messy)
      var next = xml.querySelector("block > next");
      if (next) next.remove();
      // We remove the connected block, and replace it with the shadow
      if (this.settings.get("raw_input")) {
        const self = this;
        xml.querySelectorAll("value").forEach((node) => {
          var blockInput = node.querySelector("block");
          if (blockInput) blockInput.remove();
          node.querySelector("shadow > field").textContent = self.args[node.attributes.name.nodeValue];
        });
      }
      return xml;
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
        (searchQueries.categories || [this.category]).toLowerCase().includes((this.category || "").toLowerCase()) ||
        this.textSearchMatch(searchQueries.text) > 0
      );
      return matches;
    }
    dispose () {
        this.workspace.dispose();
        this.row.remove();
    }
  }
export default BlockRow;