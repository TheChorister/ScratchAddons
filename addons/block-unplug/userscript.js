export default async function ({ addon, console }) {
  var ScratchBlocks = await addon.tab.traps.getBlockly();
  const old_unplug = ScratchBlocks.Block.prototype.unplug;
  ScratchBlocks.Block.prototype.unplug = function (heal_stack) {
    old_unplug.bind(this, true);
  };
};
