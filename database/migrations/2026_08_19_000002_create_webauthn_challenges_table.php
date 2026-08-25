<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Retos (challenges) de las ceremonias WebAuthn: se guardan temporalmente
        // en el servidor y se comparan con los que devuelve el dispositivo.
        Schema::create('webauthn_challenges', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('challenge', 128);
            $table->string('purpose', 20);
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webauthn_challenges');
    }
};