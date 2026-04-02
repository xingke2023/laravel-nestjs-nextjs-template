<?php

return [
    'secret' => env('JWT_SECRET'),
    'algo'   => env('JWT_ALGO', 'HS256'),
];
