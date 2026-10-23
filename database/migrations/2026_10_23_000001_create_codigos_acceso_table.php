<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Codigo de entrada que genera el propio usuario (web) y que porteria
// escanea o digita desde el movil para registrar su Entrada.
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('codigos_acceso')) {
            return;
        }

        Schema::create('codigos_acceso', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fk_id_usuario');
            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('pin', 6)->index();
            $table->string('tipo', 10)->default('entrada');
            $table->dateTime('expira_en');
            $table->dateTime('usado_en')->nullable();
            $table->timestamps();

            $table->index(['fk_id_usuario', 'usado_en']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codigos_acceso');
    }
};
