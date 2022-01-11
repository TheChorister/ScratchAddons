export default async function ({addon, console}) {
  console.log(t=>eval(t));
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  let finishedAnimating = true;
  let hidden = false;/*
  /* Button /
  const button = document.createElement('img');
  button.classList.add(
    addon.tab.scratchClass('stage-header_stage-button'),
    addon.tab.scratchClass('button_outlined-button')
  );
  const updateButton = function () {
    button.src = `${addon.self.dir}/${hidden ? 'show' : 'hide'}.svg`
  }
  addon.tab.appendToSharedSpace({space: 'afterDevTools', element: button, order: 1});
  updateButton();*/
  let hideElements = {}
  let elementNames = [];
  const initializeElement = async function (elName, elClass) {
    hideElements[elName] = await addon.tab.waitForElement(`[class^=${elClass}]`, {
      reduxCondition: state => !state.scratchGui.mode.isPlayerOnly
    });
    elementNames.push(elName);
  }
  await initializeElement('hideBackpack', 'backpack_backpack-container');
  await initializeElement('hideStage', 'stage-wrapper_stage-wrapper');
  await initializeElement('hideSpritePane', 'gui_stage-and-target-wrapper');
  await initializeElement('hideNavigationBar', 'gui_menu-bar-position');
  const resetHide = function () {
    hidden = false;
    elementNames.forEach(showElement);
  }
  const calculateCss = async function () {
    if (addon.settings.get('hideStage') && !addon.settings.get('hideSpritePane') && hidden) {
      hideElements.hideSpritePane.style.paddingTop = '2.75rem';
    } else {
      hideElements.hideSpritePane.style.paddingTop = '';
    }
    const body = await addon.tab.waitForElement('[class^=gui_body-wrapper]');
    if (addon.settings.get('hideNavigationBar') && hidden) {
      body.style.height = '100%';
    } else {
      body.style.height = '';
    }
  }
  const showElement = function (el, index) {
    hideElements[el].style.display = '';
    hideElements[el].classList.remove('sa-hidden');
  }
  const hideElement = function (el, index) {
    if (addon.settings.get(el)) {
      hideElements[el].style.display = 'none';
      hideElements[el].classList.add('sa-hidden');
    }
  }
  const setElement = function (el, index) {
    if (addon.settings.get(el) && hidden) {
      hideElement(el);
    } else {
      showElement(el);
    }
  }
  /* Button */
  const button = document.createElement('img');
  button.classList.add(
    addon.tab.scratchClass('stage-header_stage-button'),
    addon.tab.scratchClass('button_outlined-button'),
    'sa-zen-mode-button'
  );
  const updateButton = function () {
    button.src = `${addon.self.dir}/${hidden ? 'show' : 'hide'}.svg`
  }
  const addButtonToDOM = function (b) {
    if (document.querySelector('#s3devToolBar')) {
      document.querySelector('#s3devToolBar').insertAdjacentElement(b);
    } else {
      addon.tab.appendToSharedSpace({space: 'afterSoundTab', element: b, order: 4});
    }
  }

  addButtonToDOM(button)
  updateButton();

  const hideStuff = async function () {
    if (addon.tab.editorMode === 'editor') {
      elementNames.forEach(setElement);
      await calculateCss();
      updateButton();
      if (addon.settings.get('fullscreen')) {
        if (hidden) {
          document.querySelector('[class^=gui_body-wrapper]').requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
      ScratchBlocks.svgResize(ScratchBlocks.getMainWorkspace());
    }
  }

  const toggleHide = function () {
    hidden = !hidden;
    hideStuff();
  };

  button.onclick = toggleHide;

  elementNames.forEach(el => el.classList.add('sa-zen-mode-hideable'));

  addon.tab.addEventListener('urlChange', resetHide);
  addon.settings.addEventListener('change', hideStuff);/*
  let keysPressed = [];
  window.addEventListener('keydown', function (e) {
    if (keysPressed.indexOf(e.key) < 0) {
      keysPressed.push(e.key);
    }
  });
  window.addEventListener('keyup', function (e) {
    if (keysPressed.sort() === [76, 91] && (e.ctrlKey || e.metaKey)) {
      hideStuff()
    }
    if (keysPressed.indexOf(e.key) >= 0) {
      keysPressed.splice(keysPressed.indexOf(e.key), 1);
    }
  });*/
}
