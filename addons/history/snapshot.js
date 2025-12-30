// just to make sure there are absolutely
// there are no references
// NB: only json serialisable things can go here
function clone (obj) {
    return JSON.parse(JSON.stringify(obj));
}

class BlockVMSnapshot {
    constructor (blocks) {
        this._blocks = clone(blocks._blocks);
        this._scripts = clone(blocks._scripts);
        this.forceNoGlow = clone(blocks.forceNoGlow);
    }

    restore (blocks) {
        console.log('restoring blocks', blocks, this);
        blocks._blocks = this._blocks;
        blocks._scripts = this._scripts;
        blocks.forceNoGlow = this.forceNoGlow;
        blocks.resetCache();
        console.log(blocks);
    }

    serialise () {
        return {
            _blocks: this._blocks,
            _scripts: this._scripts,
            forceNoGlow: this.forceNoGlow,
        }
    }

    static deserialise (obj) {
        return new BlockVMSnapshot(obj);
    }
}

class TargetVMSnapshot {
    constructor(target) {
        // there are probably more properties
        // and this should really only use properties dependent on whether
        // it is the stage or not 
        // e.g. tempo, textToSpeechLanguage, videoStage, volume for stage
        // and only x, y, visible, rotationStyle, size for sprites
        this.currentCostume = clone(target.currentCostume);
        this.isOriginal = clone(target.isOriginal);
        this.id = clone(target.id);
        this.direction = clone(target.direction);
        this.draggable = clone(target.draggable);
        this.effects = clone(target.effects);
        this.rotationStyle = clone(target.rotationStyle);
        this.size = clone(target.size);
        this.variables = clone(target.variables);
        this.visible = clone(target.visible);
        this.x = clone(target.x);
        this.y = clone(target.y);
        this._customState = clone(target._customState);
        this.blocks = new BlockVMSnapshot(target.blocks);
        this.variables = Object.values(target.variables).map(v => ({ id: v.id, name: v.name, type: v.type, isCloud: v.isCloud }));
        //this.drawableID = target.drawableID;
        // costumes/sounds?
    }

    restore(vm, forceTarget = null) {
        var target = forceTarget || vm.runtime.getTargetById(this.id);
        target.id = this.id;
        target.isOriginal = this.isOriginal;
        //target.drawableID = this.drawableID;
        //target.setVisible(this.visible);
        //target.setSize(this.size);
        //target.setDraggable(this.draggable);
        //target.setDirection(this.direction);
        //target.setCostume(this.currentCostume);
        //target.setRotationStyle(this.rotationStyle);
        //target.clearEffects();
        //for (let effect in this.effects) {
        //    target.setEffect(effect, this.effects[effect]);
        //}
        target.visible = this.visible;
        target.size = this.size;
        target.draggable = this.draggable;
        target.direction = this.direction;
        target.currentCostume = this.currentCostume;
        target.rotationStyle = this.rotationStyle;
        target.effects = this.effects;
        target.variables = this.variables;
        target.x = this.x;
        target.y = this.y;
        target._customState = this._customState;
        target.variables = {};
        this.variables.forEach(v => target.createVariable(v.id, v.name, v.type, v.isCloud));
        this.blocks.restore(target.blocks);
        target.updateAllDrawableProperties();
    }

    serialise() {
        return {
            id: this.id,
            isOriginal: this.isOriginal,
            visible: this.visible,
            size: this.size,
            draggable: this.draggable,
            direction: this.direction,
            currentCostume: this.currentCostume,
            rotationStyle: this.rotationStyle,
            effects: this.effects,
            variables: this.variables,
            x: this.x,
            y: this.y,
            blocks: this.blocks.serialise(),
            _customState: this._customState,
        }
    }

    static deserialise(obj) {
        // the constructor actually only takes the top-level
        // properties anyway so technically this works
        return new TargetVMSnapshot(obj);
    }
}

class SpriteVMSnapshot {
    constructor(sprite) {
        var original = sprite.clones.find(c => c.isOriginal)
        this.id = clone(original.id);
        // costumes/sounds?
        this.name = clone(sprite.name);
        // do we do clones too?
        this.clones = sprite.clones.map(c => new TargetVMSnapshot(c));
    }

    restore(vm) {
        // currently doesn't deal with deletions of sprites
        var sprite = vm.runtime.getTargetById(this.id).sprite;
        sprite.name = this.name;
        for (let clone of this.clones) {
            var target = vm.runtime.getTargetById(clone.id);
            if (!target) {
                target = sprite.createClone();
                /*
                // we cheat to get the renderer to set the drawable ID to what we want
                // i don't know if this is really necessary
                // and it could very easily break if there is a drawable already there
                const oldId = vm.runtime.renderer._nextDrawableId;
                vm.runtime.renderer._nextDrawableId = clone.id;
                */
                target.initDrawable('sprite');
                //vm.runtime.renderer._nextDrawableId = oldId+1;
                vm.runtime.addTarget(target);
                console.log('created clone of', sprite, target);
            }
            clone.restore(vm, target);
        }
    }
}

class _StackFrameSnap {
    constructor(frame) {
        // i'm not entirely sure what executionContext is
        // i've only ever seen it as null
        // if it's an instance we may need to have a sub-class for it
        this.executionContext = clone(frame.executionContext);
        this.isLoop = clone(frame.isLoop);
        this.justReported = clone(frame.justReported);
        this.params = clone(frame.params);
        this.reported = clone(frame.reported);
        this.reporting = clone(frame.reporting);
        this.waitingReporter = clone(frame.waitingReporter);
        this.warpMode = clone(frame.warpMode);
    }

    restore(frame) {
        frame.executionContext = this.executionContext;
        frame.isLoop = this.isLoop;
        frame.justReported = this.justReported;
        frame.params = this.params;
        frame.reported = this.reported;
        frame.reporting = this.reporting;
        frame.waitingReporter = this.waitingReporter;
        frame.warpMode = this.warpMode;
    }

    serialise() {
        return {
            executionContext: this.executionContext,
            isLoop: this.isLoop,
            justReported: this.justReported,
            params: this.params,
            reported: this.reported,
            reporting: this.reporting,
            waitingReporter: this.waitingReporter,
            warpMode: this.warpMode,
        }
    }

    static deserialise(obj) {
        return new _StackFrameSnap(obj);
    }
}

class ThreadVMSnapshot {
    constructor(thread) {
        this.stack = clone(thread.stack);
        this.stackFrames = thread.stackFrames.map(s => new _StackFrameSnap(s));
        this.status = clone(thread.status);
        this.isKilled = clone(thread.isKilled);
        this.target = clone(thread.target.id);
        this.requestScriptGlowInFrame = clone(thread.requestScriptGlowInFrame);
        this.blockGlowInFrame = clone(thread.blockGlowInFrame);
        this.justReported = clone(thread.justReported);
        this.topBlock = clone(thread.topBlock);
        this.stackClick = clone(thread.stackClick);
    }

    restore(vm) {
        var thread = vm.runtime._pushThread(this.topBlock, vm.runtime.getTargetById(this.target), { updateMonitor: this.updateMonitor, stackClick: this.stackClick });
        //thread.stack = this.stack;
        //thread.stackFrames = this.stackFrames;
        for (let i in this.stack) {
            thread.pushStack(this.stack[i]);
            this.stackFrames[i].restore(thread.stackFrames[thread.stackFrames.length - 1])
        }
        thread.isKilled = this.isKilled;
        thread.requestScriptGlowInFrame = this.requestScriptGlowInFrame;
        thread.blockGlowInFrame = this.blockGlowInFrame;
        thread.justReported = this.justReported;
    }

    serialise() {
        return {
            stack: this.stack,
            isKilled: this.isKilled,
            // so that we can pass this straight back into the
            // constructor easily
            target: { id: this.target },
            requestScriptGlowInFrame: this.requestScriptGlowInFrame,
            blockGlowInFrame: this.blockGlowInFrame,
            justReported: this.justReported,
            topBlock: this.topBlock,
            stackClick: this.stackClick,
            stackFrames: this.stackFrames.map(s => s.serialise()),
        }
    }

    static deserialise(obj) {
        return new ThreadVMSnapshot(obj);
    }
}

class RuntimeVMSnapshot {
    constructor(runtime) {
        if (runtime) {
            this.monitorBlocks = new BlockVMSnapshot(runtime.monitorBlocks);
            this.sprites = runtime.targets.filter(t => t.isOriginal).map(t => new SpriteVMSnapshot(t.sprite));
            this.threads = runtime.threads.map(t => new ThreadVMSnapshot(t));
        } else {
            this.monitorBlocks = null;
            this.sprite = [];
            this.threads = [];
        }
    }

    restore(vm) {
        this.sprites.forEach(t => t.restore(vm));
        this.threads.forEach(t => t.restore(vm));
    }

    serialise() {
        return {
            sprites: this.sprites.map(t => t.serialise()),
            threads: this.threads.map(t => t.serialise()),
            monitorBlocks: this.monitorBlocks.serialise(),
        }
    }

    static deserialise(obj) {
        var snap = new RuntimeVMSnapshot();
        snap.monitorBlocks = BlockVMSnapshot.deserialise(obj.monitorBlocks);
        snap.sprites = obj.sprites.map(s => SpriteVMSnapshot.deserialise(s));
        snap.threads = obj.threads.map(t => ThreadVMSnapshot.deserialise(t));
        return snap;
    }
}

class VMSnapshot {
    constructor(vm) {
        if (vm) { // then we're deserialising so we keep them empty
            this.runtime = new RuntimeVMSnapshot(vm.runtime);
            this.editingTarget = clone(vm.editingTarget.id);
            // monitors?
        } else {
            this.runtime = null;
            this.editingTarget = null;
        }
    }

    restore(vm) {
        vm.setEditingTarget(this.editingTarget);
        this.runtime.restore(vm);
        vm.refreshWorkspace();
    }

    serialise() {
        return {
            runtime: this.runtime.serialise(),
            editingTarget: this.editingTarget,
        }
    }

    static deserialise(obj) {
        // more complicated than before
        // as there's no 1:1 map between vm and serialised
        // (though I could done something like { runtime: sprites: obj.sprites })
        // but then I would have had to make them have 'isOriginal'
        var snap = new VMSnapshot();
        snap.editingTarget = obj.editingTarget;
        snap.runtime = RuntimeVMSnapshot.deserialise(obj.runtime);
        return snap;
    }
}

class Snapshot {
    constructor (vm, name="Untitled Snapshot", time) {
        this.vm = new VMSnapshot(vm);
        this.name = name;
        this.time = time || Date.now();
    }

    restore(vm, app) {
        this.vm.restore(vm);
        if (app) {
            app.showSnapshot(this);
        }
    }

    serialise () {
        return {
            vm: this.vm.serialise(),
            name: this.name,
            time: this.time,
        }
    }

    static deseralise(obj) {
        return new Snapshot(obj.name, VMSnapshot.deserialise(obj.vm), obj.time);
    }
}

export { 
    BlockVMSnapshot,
    TargetVMSnapshot,
    SpriteVMSnapshot,
    ThreadVMSnapshot,
    RuntimeVMSnapshot,
    VMSnapshot,
    Snapshot as default,
 }