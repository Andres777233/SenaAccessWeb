<?php

namespace Database\Seeders;

use App\Models\Festivo;
use Illuminate\Database\Seeder;

// Festivos de Colombia 2024-2028: fijos + ley Emiliani (al lunes siguiente)
// + Semana Santa y fiestas de easter_date(). Idempotente (updateOrCreate).
class FestivoSeeder extends Seeder
{
    public function run(): void
    {
        foreach (range(2024, 2028) as $anio) {
            foreach ($this->festivosDe($anio) as [$fecha, $nombre]) {
                Festivo::updateOrCreate(['fecha' => $fecha], ['nombre' => $nombre]);
            }
        }
    }

    private function lunesSiguiente(\DateTime $d): string
    {
        if ($d->format('N') !== '1') {
            $d->modify('next monday');
        }
        return $d->format('Y-m-d');
    }

    private function festivosDe(int $anio): array
    {
        $out = [];
        // Fijos.
        foreach (['01-01' => 'Año Nuevo', '05-01' => 'Día del Trabajo', '07-20' => 'Independencia', '08-07' => 'Batalla de Boyacá', '12-08' => 'Inmaculada Concepción', '12-25' => 'Navidad'] as $md => $nombre) {
            $out[] = ["$anio-$md", $nombre];
        }
        // Emiliani: si no cae lunes, se observa el lunes siguiente.
        foreach (['01-06' => 'Reyes Magos', '03-19' => 'San José', '06-29' => 'San Pedro y San Pablo', '08-15' => 'Asunción', '10-12' => 'Día de la Raza', '11-01' => 'Todos los Santos', '11-11' => 'Independencia de Cartagena'] as $md => $nombre) {
            $out[] = [$this->lunesSiguiente(new \DateTime("$anio-$md")), $nombre];
        }
        // Semana Santa y fiestas móviles (pascua = domingo de resurrección).
        $pascua = (new \DateTime())->setTimestamp(easter_date($anio));
        $mas = fn (int $dias) => (clone $pascua)->modify("+$dias days")->format('Y-m-d');
        $out[] = [$mas(-3), 'Jueves Santo'];
        $out[] = [$mas(-2), 'Viernes Santo'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+39 days')), 'Ascensión'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+60 days')), 'Corpus Christi'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+68 days')), 'Sagrado Corazón'];
        return $out;
    }
}
