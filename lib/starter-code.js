/** Стартовый код: база для новых проектов и демо при первом запуске */
(function () {
  'use strict';

  function uiText(key, params, fallback) {
    if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
      return PGZI18n.uiText(key, params, fallback);
    }
    return fallback != null ? fallback : key;
  }

  function pyString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  window.PGZ_BASE_CODE = 'import pgzrun\n\npgzrun.go()\n';

  window.PGZ_buildDemoCode = function () {
    var comment = uiText(
      'starterCode.demoComment',
      null,
      'Мини-раннер: кружок бежит и прыгает через пробел'
    );
    var title = pyString(uiText('starterCode.demoTitle', null, 'Мой раннер'));
    var hint = pyString(uiText('starterCode.demoHint', null, 'Пробел — прыжок'));

    return (
      'import pgzrun\n\n' +
      '# ' + comment + '\n' +
      'WIDTH = 600\n' +
      'HEIGHT = 400\n' +
      'TITLE = "' + title + '"\n\n' +
      'player_x = 80\n' +
      'player_y = 300\n' +
      'player_vy = 0\n' +
      'gravity = 0.7\n' +
      'jump_power = -13\n' +
      'ground = 340\n\n' +
      'def draw():\n' +
      '    screen.fill((135, 206, 250))\n' +
      '    screen.draw.filled_rect(Rect(0, ground, WIDTH, HEIGHT - ground), (76, 175, 80))\n' +
      '    screen.draw.filled_circle((player_x, player_y), 18, (255, 99, 71))\n' +
      '    screen.draw.text("' + hint + '", (12, 12), fontsize=22, color="white")\n\n' +
      'def update():\n' +
      '    global player_x, player_y, player_vy\n' +
      '    player_x += 2\n' +
      '    if player_x > WIDTH + 20:\n' +
      '        player_x = -20\n' +
      '    player_vy += gravity\n' +
      '    player_y += player_vy\n' +
      '    if player_y >= ground - 18:\n' +
      '        player_y = ground - 18\n' +
      '        player_vy = 0\n' +
      '    if keyboard.space and player_y >= ground - 19:\n' +
      '        player_vy = jump_power\n\n' +
      'pgzrun.go()\n'
    );
  };

  window.PGZ_getProjectTemplate = function (opts) {
    opts = opts || {};
    var width = opts.width != null ? opts.width : 800;
    var height = opts.height != null ? opts.height : 600;
    var title = pyString(opts.title || '');
    var description = opts.description ||
      uiText('starterCode.baseComment', null, 'Pygame Zero');
    var placeholder = uiText(
      'starterCode.placeholderComment',
      null,
      'Ваш код должен быть здесь'
    );

    return (
      'import pgzrun\n\n' +
      '# ' + description + '\n\n' +
      'WIDTH = ' + width + '\n' +
      'HEIGHT = ' + height + '\n\n' +
      'TITLE = "' + title + '"\n\n' +
      '# ' + placeholder + '\n\n\n' +
      'pgzrun.go()\n'
    );
  };

  window.PGZ_getNewProjectCode = function () {
    if (!localStorage.getItem('pgz_first_demo_done')) {
      localStorage.setItem('pgz_first_demo_done', '1');
      return window.PGZ_buildDemoCode();
    }
    return window.PGZ_BASE_CODE;
  };

  window._starterCodeTest = {
    uiText: uiText,
    pyString: pyString,
    buildDemoCode: window.PGZ_buildDemoCode,
    getProjectTemplate: window.PGZ_getProjectTemplate
  };
})();
