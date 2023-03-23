export default async function ({ addon, console, msg }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  // There is a builtin workspace option of collapsing where in the workspace one can expand/collapse all but the translations seem to be missing from Blockly so we must add then ourselves
  ScratchBlocks.getMainWorkspace().options.collapse = true;
  ScratchBlocks.Msg.COLLAPSE_ALL = msg("collapse-all");
  ScratchBlocks.Msg.EXPAND_ALL = msg("expand-all");
  // Checks if a block qualifies for collapsability
  function shouldCollapse(block) {
    // If the setting is not restricted to only hats/c-/e- blocks return true
    if (!addon.settings.get("nested-blocks")) {
      return true;
    }
    // A hat has no output and no previous connections
    if (!block.outputConnection && !block.previousConnection) {
      return true;
    }
    // Get input list
    return (
      block.inputList
        // map if the input is a statement
        .map((input) => input.connection && input.connection.type === ScratchBlocks.NEXT_STATEMENT)
        // reduce such that if any input has been true (see above) then the array is reduced to true
        .reduce((a, b) => a || b)
    );
  }

  // Hide blocks underneath hats when collapsed

  // Store old setCollapsed
  const oldCollapse = ScratchBlocks.BlockSvg.prototype.setCollapsed;

  // Override
  ScratchBlocks.BlockSvg.prototype.setCollapsed = function (collapsed) {
    this.inputList.forEach((input) => {
      if (!!input.outlinePath) input.outlinePath.style.display = collapsed ? "none" : "";
    });

    oldCollapse.call(this, collapsed);

    // We do this anyway if we are expanding just in case the user changed the setting while a hat was collapsed
    if ((addon.settings.get("hide-underhat") || !collapsed) && !this.outputConnection && !this.previousConnection) {
      var children = this.getChildren();
      console.log(children);
      for (var i = children.length - 1; i >= 0; i--) {
        // This feels hacky but I can't find another way of doing this
        children[i].getSvgRoot().style.display = collapsed ? "none" : "";
      }
    }
  };

  addon.tab.createBlockContextMenu(
    (items, block) => {
      // We want to allow collapsed blocks to be expanded anyway
      if (shouldCollapse(block) || block.isCollapsed()) {
        items.push({
          enabled: true,
          separator: false,
          text: msg(block.isCollapsed() ? "expand" : "collapse"),
          callback: () => block.setCollapsed(!block.isCollapsed()),
        });
      }
      return items;
    },
    { blocks: true }
  );
  // !TODO! shadows don't collapse for some reason so I'll make a fix here but this should probably be amended in the scratch-blocks repo
}
