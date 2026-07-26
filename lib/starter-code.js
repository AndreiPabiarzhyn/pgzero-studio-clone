/** Стартовый код: база для новых проектов и демо при первом запуске */
window.PGZ_BASE_CODE = `import pgzrun

pgzrun.go()
`;

window.PGZ_DEMO_CODE = `import pgzrun

# Мини-раннер: кружок бежит и прыгает через пробел
WIDTH = 600
HEIGHT = 400
TITLE = "Мой раннер"

player_x = 80
player_y = 300
player_vy = 0
gravity = 0.7
jump_power = -13
ground = 340

def draw():
    screen.fill((135, 206, 250))
    screen.draw.filled_rect(Rect(0, ground, WIDTH, HEIGHT - ground), (76, 175, 80))
    screen.draw.filled_circle((player_x, player_y), 18, (255, 99, 71))
    screen.draw.text("Пробел — прыжок", (12, 12), fontsize=22, color="white")

def update():
    global player_x, player_y, player_vy
    player_x += 2
    if player_x > WIDTH + 20:
        player_x = -20
    player_vy += gravity
    player_y += player_vy
    if player_y >= ground - 18:
        player_y = ground - 18
        player_vy = 0
    if keyboard.space and player_y >= ground - 19:
        player_vy = jump_power

pgzrun.go()
`;

window.PGZ_STARTER_CODE = window.PGZ_DEMO_CODE;

window.PGZ_getNewProjectCode = function () {
    if (!localStorage.getItem('pgz_first_demo_done')) {
        localStorage.setItem('pgz_first_demo_done', '1');
        return window.PGZ_DEMO_CODE;
    }
    return window.PGZ_BASE_CODE;
};
