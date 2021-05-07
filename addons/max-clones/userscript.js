export default async function ({ addon }) {
  // See https://github.com/LLK/scratch-vm/blob/develop/src/engine/runtime.js#L717
  addon.tab.traps.vm.runtime.__defineGetter__("MAX_CLONES", function () {
    return addon.settings.get("clones_infinite") ? Infinity : addon.settings.get("clones_max");
  });
}
