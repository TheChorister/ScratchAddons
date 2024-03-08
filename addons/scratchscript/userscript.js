import * as ScratchScript from "./lib.js";

export default async function ({ addon, console }) {
  addon.tab.redux.initialize();
  await new Promise((resolve) => {
    if (addon.tab.traps.vm.editingTarget) return resolve();
    addon.tab.traps.vm.runtime.once("PROJECT_LOADED", resolve);
  });
  await addon.tab.scratchClassReady();
  console.log(ScratchScript);
  console.log(addon.tab.traps.vm);
  var project = new ScratchScript.compiling.scope.ProjectScope(addon.tab.traps.vm);
  var scope = new ScratchScript.compiling.scope.BlockScope(project.vm.editingTarget, project);
  console.log(scope);

  // DOM:
  // Tab
  const tabs = await addon.tab.waitForElement("[class*=gui_tabs]");
  // Heading
  const heading = document.createElement("li");
  heading.classList.add(addon.tab.scratchClass("react-tabs_react-tabs__tab"), addon.tab.scratchClass("gui_tab"));
  heading.id = "react-tabs-9";
  const headingIcon = document.createElement("img");
  headingIcon.src = addon.self.dir + "/icon.svg";
  const headingText = document.createTextNode("Script");
  heading.appendChild(headingIcon);
  heading.appendChild(headingText);
  addon.tab.displayNoneWhileDisabled(heading, { display: "flex" });

  const panel = document.createElement("div");
  panel.classList.add(addon.tab.scratchClass("react-tabs_react-tabs__tab-panel"), addon.tab.scratchClass("gui_tab-panel"));

  // Content
  const ssArea = document.createElement("div");
  ssArea.classList.add("sa-ss-area", addon.tab.scratchClass("asset-panel_wrapper"));
  addon.tab.displayNoneWhileDisabled(ssArea, { display: "flex" });
  panel.appendChild(ssArea);
  tabs.appendChild(panel);

  function setVisible(visible) {
    if (visible) {
      heading.classList.add(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      const contentArea = document.querySelector("[class^=gui_tabs]");
      contentArea.insertAdjacentElement("beforeend", panel);
    } else {
      heading.classList.remove(
        addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
        addon.tab.scratchClass("gui_is-selected")
      );
      panel.remove();
    }
  }


  heading.addEventListener("click", (e) => {
    addon.tab.redux.dispatch({ type: "scratch-gui/navigation/ACTIVATE_TAB", activeTabIndex: 4 });
    panel.classList.add(
      addon.tab.scratchClass("react-tabs_react-tabs__tab--selected"),
      addon.tab.scratchClass("gui_is-selected")
    );
  });
  addon.tab.redux.addEventListener("statechanged", ({ detail }) => {
    if (detail.action.type === "scratch-gui/navigation/ACTIVATE_TAB") {
      const switchedToVarManager = detail.action.activeTabIndex === 4;

      setVisible(switchedToVarManager);
    } else if (detail.action.type === "scratch-gui/mode/SET_PLAYER") {
      if (!detail.action.isPlayerOnly && addon.tab.redux.state.scratchGui.editorTab.activeTabIndex === 4) {
        // DOM doesn't actually exist yet
        queueMicrotask(() => setVisible(true));
      }
    }
  });
  addon.self.addEventListener("disabled", () => {
    if (addon.tab.redux.state.scratchGui.editorTab.activeTabIndex === 4) {
      addon.tab.redux.dispatch({ type: "scratch-gui/navigation/ACTIVATE_TAB", activeTabIndex: 0 });
    }
  });

  addon.tab.appendToSharedSpace({ space: "afterSoundTab", element: heading, order: 4 });
}