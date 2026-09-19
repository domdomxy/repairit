<?php

test('every page ships the script that applies the saved theme before first paint', function () {
    $this->withoutVite();

    $this->get('/')
        ->assertOk()
        ->assertSee("localStorage.getItem('theme')", false)
        ->assertSee("classList.toggle('dark'", false);
});
