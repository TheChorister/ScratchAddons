import { default as Snapshot } from "./snapshot.js";
import { default as SnapshotView } from "./interface/snapshot_view.js";

export default async function ({ addon, console }) {
    var vm = addon.tab.traps.vm;
    //var ScratchBlocks = await addon.tab.traps.getBlockly();
    // !!! FOR DEBUG ONLY - REMOVE BEFORE ACTUALLY USING
    window.Snapshot = Snapshot;
    window.vm = vm;
    window.SnapshotView = SnapshotView;
}
