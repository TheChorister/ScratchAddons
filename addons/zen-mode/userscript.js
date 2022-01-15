export default async function ({ addon, console }) {
  console.log((t) => eval(t));
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  let button;

  let hidden = false;

  /* Hide Element Functions */
  let hideElements = {};
  let elementNames = [];

  const initializeElement = async function (elName, elClass) {
    hideElements[elName] = await addon.tab.waitForElement(`[class^=${elClass}]`, {
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    elementNames.push(elName);
  };

  const calculateCss = async function () {
    const body = await addon.tab.waitForElement("[class^=gui_body-wrapper]");
    if (addon.settings.get("hideNavigationBar") && hidden) {
      body.style.height = "100%";
    } else {
      body.style.height = "";
    }
    const spriteSelector = await addon.tab.waitForElement("[class^=sprite-selector_scroll-wrapper]");
    if (
      addon.settings.get("hideStage") &&
      !addon.settings.get("hideSpritePane") &&
      addon.settings.get("hideSpriteInfoPane") &&
      addon.settings.get("customSpriteSelector") &&
      hidden
    ) {
      spriteSelector.style.width = `${
        (addon.settings.get("spriteSelectorWidth"))*5-
        (addon.settings.get("spriteSelectorWidth")-1)*0.5}rem`;
      hideElements.hideSpritePane.style.width = `calc(${spriteSelector.style.width} + 4.25rem)`;
    } else if (
      addon.settings.get("hideStage") &&
      !addon.settings.get("hideSpritePane") &&
      addon.settings.get("hideSpriteInfoPane") &&
      hidden
    ) {
      // Simulate Stage Pushing Width Out
      hideElements.hideSpritePane.style.minWidth = "480px";
    } else {
      spriteSelector.style.width = "";
      hideElements.hideSpritePane.style.width = "";
      hideElements.hideSpritePane.style.minWidth = "";
    }
    if (addon.settings.get("hideStage") && !addon.settings.get("hideSpritePane") && addon.settings.get("customSpriteSelector") && hidden) {
      hideElements.hideSpritePane.classList.add("sa-zen-mode-stage-accomodate");
    } else {
      hideElements.hideSpritePane.classList.remove("sa-zen-mode-stage-accomodate");
    }
  };

  const resetHide = function () {
    hidden = false;
    elementNames.forEach(showElement);
  };

  const showElement = function (el) {
    hideElements[el].classList.remove("sa-zen-mode-hidden");
  };

  const hideElement = function (el, index) {
    // Ignore the sprite pang being hidden if the stage is not hidden
    // because the sprite pane element purposefully covers the entire stage
    // so that there is not an empty element if both are hidden
    if (
      el === "hideSpritePane" ? addon.settings.get("hideStage") && addon.settings.get(el)
      : el === "hideSpriteInfoPane" ?
          addon.settings.get("hideStage") &&
          !addon.settings.get("hideSpritePane") &&
          addon.settings.get(el)
        : addon.settings.get(el)
      ) {
      console.log(el, addon.settings.get(el))
      hideElements[el].classList.add("sa-zen-mode-hidden");
    }
  };
  const setElement = function (el) {
    if (addon.settings.get(el) && hidden) {
      hideElement(el);
    } else {
      showElement(el);
    }
  };

  const hideStuff = async function () {
    if (addon.tab.editorMode === "editor") {
      elementNames.forEach(setElement);
      await calculateCss();
      updateButton(button);
      if (addon.settings.get("fullscreen")) {
        if (hidden) {
          document.querySelector(".gui").requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
      ScratchBlocks.svgResize(ScratchBlocks.getMainWorkspace());
    }
  };

  const toggleHide = function () {
    hidden = !hidden;
    hideStuff();
  };

  const initiateHideElements = async function () {
    await initializeElement("hideBackpack", "backpack_backpack-container");
    await initializeElement("hideStage", "stage-wrapper_stage-wrapper");
    await initializeElement("hideSpritePane", "gui_stage-and-target-wrapper");
    await initializeElement("hideSpriteInfoPane", "sprite-info_sprite-info");
    await initializeElement("hideNavigationBar", "gui_menu-bar-position");

    elementNames.forEach((el) => hideElements[el].classList.add("sa-zen-mode-hideable"));
  }

  /* Button */
  const updateButton = function (b) {
    b.src = `${addon.self.dir}/${hidden ? "show" : "hide"}.svg`;
  };
  const addButtonToDOM = function (b) {
    if (document.querySelector("#s3devToolBar")) {
      document.querySelector("#s3devToolBar").insertAdjacentElement(b);
    } else {
      addon.tab.appendToSharedSpace({ space: "afterSoundTab", element: b, order: 4 });
    }
  };
  const makeButton = function () {
    const b = document.createElement("img");

    b.classList.add(
      addon.tab.scratchClass("stage-header_stage-button"),
      addon.tab.scratchClass("button_outlined-button"),
      "sa-zen-mode-button"
    );

    b.onclick = toggleHide;

    addButtonToDOM(b);
    updateButton(b);

    return b;
  };

  /* Initialize */

  await initiateHideElements();
  makeButton();

  /* Listeners */
  addon.tab.addEventListener("urlChange", resetHide);
  addon.settings.addEventListener("change", hideStuff);
  document.addEventListener("fullscreenchange", function () {
    if (hidden && !document.fullscreenElement) {
      resetHide();
    }
  });
}
