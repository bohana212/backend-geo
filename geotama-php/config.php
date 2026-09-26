<?php
/**
 * Salin file ini menjadi config.php lalu isi dengan nilai kamu sendiri.
 * JANGAN upload config.php ke repo publik.
 */

// URL backend Vercel (Telegram backend), TANPA garis miring di akhir.
define('TG_BACKEND_URL', 'https://backend-geo-48gm.vercel.app');

// Harus SAMA PERSIS dengan MASTER_API_KEY di Environment Variables Vercel.
define('TG_MASTER_API_KEY', 'sk_alive-224838744');

// String acak untuk session/CSRF. Isi bebas, panjang, dan rahasia.
define('SESSION_SALT', '9b1688a7243e69f9950c5d6451684df67a12abb7ee7f4850cb808def7a4883d1');
