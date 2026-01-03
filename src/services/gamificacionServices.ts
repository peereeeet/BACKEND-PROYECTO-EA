import { Types } from 'mongoose';
import { UsuarioProgreso, IUsuarioProgreso } from '../models/usuarioProgreso';
import { Insignia, IInsignia } from '../models/insignia';
import { logger } from '../config/logger';

export class GamificacionService {
  // Definición de niveles
  private nivelesConfig = [
    { nombre: 'Novato', puntosMin: 0, puntosMax: 99 },
    { nombre: 'Explorador', puntosMin: 100, puntosMax: 299 },
    { nombre: 'Organizador', puntosMin: 300, puntosMax: 599 },
    { nombre: 'Experto', puntosMin: 600, puntosMax: 999 },
    { nombre: 'Leyenda', puntosMin: 1000, puntosMax: Infinity },
  ];

  // Puntos por acción
  private puntosAcciones = {
    crearEvento: 50,
    unirseEvento: 10,
    asistirEvento: 20,
    dejarValoracion: 15,
    hacerAmigo: 5,
  };

  /**
   * Obtener o crear el progreso de un usuario
   */
  async obtenerProgreso(usuarioId: string): Promise<IUsuarioProgreso> {
    let progreso = await UsuarioProgreso.findOne({ usuario: usuarioId })
      .populate('insignias')
      .exec();

    if (!progreso) {
      progreso = await UsuarioProgreso.create({
        usuario: new Types.ObjectId(usuarioId),
        puntos: 0,
        nivel: 'Novato',
        insignias: [],
        estadisticas: {
          eventosCreadosTotal: 0,
          eventosUnidosTotal: 0,
          valoracionesTotal: 0,
          amigosTotal: 0,
        },
      });
      logger.info(`Progreso creado para usuario ${usuarioId}`);
    }

    return progreso;
  }

  /**
   * Otorgar puntos por una acción específica
   */
  async otorgarPuntos(
    usuarioId: string,
    accion:
      | 'crearEvento'
      | 'unirseEvento'
      | 'asistirEvento'
      | 'dejarValoracion'
      | 'hacerAmigo',
  ): Promise<IUsuarioProgreso> {
    const puntos = this.puntosAcciones[accion] || 0;
    const progreso = await this.obtenerProgreso(usuarioId);

    // Actualizar puntos
    progreso.puntos += puntos;

    // Actualizar estadísticas según la acción
    switch (accion) {
      case 'crearEvento':
        progreso.estadisticas.eventosCreadosTotal += 1;
        break;
      case 'unirseEvento':
        progreso.estadisticas.eventosUnidosTotal += 1;
        break;
      case 'dejarValoracion':
        progreso.estadisticas.valoracionesTotal += 1;
        break;
      case 'hacerAmigo':
        progreso.estadisticas.amigosTotal += 1;
        break;
    }

    // Recalcular nivel
    progreso.nivel = this.calcularNivel(progreso.puntos);

    await progreso.save();

    // Verificar si desbloqueó nuevas insignias
    await this.verificarInsignias(usuarioId);

    logger.info(
      `Usuario ${usuarioId} recibió ${puntos} puntos por ${accion}. Total: ${progreso.puntos}`,
    );

    return progreso;
  }

  /**
   * Calcular el nivel según los puntos
   */
  private calcularNivel(puntos: number): string {
    const nivel = this.nivelesConfig.find(
      (n) => puntos >= n.puntosMin && puntos <= n.puntosMax,
    );
    return nivel ? nivel.nombre : 'Novato';
  }

  /**
   * Verificar si el usuario cumple criterios para nuevas insignias
   */
  async verificarInsignias(usuarioId: string): Promise<void> {
    // Obtener progreso fresco desde la BD para evitar datos stale
    const progreso = await UsuarioProgreso.findOne({ usuario: usuarioId })
      .populate('insignias')
      .exec();

    if (!progreso) {
      logger.warn(`No se encontró progreso para usuario ${usuarioId}`);
      return;
    }

    const todasInsignias = await Insignia.find().exec();

    // Convertir a Set para búsqueda O(1) y evitar duplicados
    const insigniasActualesIds = new Set(
      progreso.insignias.map((i: Types.ObjectId | IInsignia) => {
        // Manejar tanto ObjectIds como objetos poblados
        return (typeof i === 'object' && '_id' in i ? i._id : i).toString();
      }),
    );

    for (const insignia of todasInsignias) {
      const insigniaIdStr = insignia._id.toString();

      // Si ya tiene esta insignia, continuar
      if (insigniasActualesIds.has(insigniaIdStr)) {
        continue;
      }

      // Verificar criterios
      const cumple = this.cumpleCriterios(progreso, insignia);

      if (cumple) {
        // Verificar una vez más antes de otorgar (por si acaso hubo concurrencia)
        const progresoActualizado = await UsuarioProgreso.findById(
          progreso._id,
        );
        if (!progresoActualizado) continue;

        const yaLaTiene = progresoActualizado.insignias.some(
          (i: Types.ObjectId | IInsignia) => i.toString() === insigniaIdStr,
        );

        if (!yaLaTiene) {
          // Otorgar insignia usando operador atómico $addToSet para evitar duplicados
          await UsuarioProgreso.findByIdAndUpdate(
            progreso._id,
            {
              $addToSet: { insignias: insignia._id },
              $inc: { puntos: insignia.puntos },
            },
            { new: true },
          );

          logger.info(
            `Usuario ${usuarioId} desbloqueó insignia: ${insignia.nombre} (+${insignia.puntos} puntos)`,
          );
        }
      }
    }
  }

  /**
   * Verificar si el progreso cumple los criterios de una insignia
   */
  private cumpleCriterios(
    progreso: IUsuarioProgreso,
    insignia: IInsignia,
  ): boolean {
    const { criterios } = insignia;
    const { estadisticas, puntos } = progreso;

    if (
      criterios.eventosCreadosRequeridos &&
      estadisticas.eventosCreadosTotal < criterios.eventosCreadosRequeridos
    ) {
      return false;
    }

    if (
      criterios.eventosUnidosRequeridos &&
      estadisticas.eventosUnidosTotal < criterios.eventosUnidosRequeridos
    ) {
      return false;
    }

    if (
      criterios.valoracionesRequeridas &&
      estadisticas.valoracionesTotal < criterios.valoracionesRequeridas
    ) {
      return false;
    }

    if (
      criterios.amigosRequeridos &&
      estadisticas.amigosTotal < criterios.amigosRequeridos
    ) {
      return false;
    }

    if (criterios.puntosRequeridos && puntos < criterios.puntosRequeridos) {
      return false;
    }

    return true;
  }

  /**
   * Obtener el ranking de usuarios (leaderboard)
   */
  async obtenerRanking(limite: number = 10): Promise<any[]> {
    const ranking = await UsuarioProgreso.find()
      .sort({ puntos: -1 })
      .limit(limite)
      .populate('usuario', 'username gmail')
      .populate('insignias')
      .exec();

    return ranking.map((r, index) => ({
      posicion: index + 1,
      usuario: (r.usuario as any).username,
      gmail: (r.usuario as any).gmail,
      puntos: r.puntos,
      nivel: r.nivel,
      insignias: r.insignias.length,
    }));
  }

  /**
   * Obtener todas las insignias disponibles
   */
  async obtenerTodasInsignias(): Promise<IInsignia[]> {
    return await Insignia.find().exec();
  }

  /**
   * Inicializar insignias predefinidas (seed)
   */
  async inicializarInsignias(): Promise<void> {
    const count = await Insignia.countDocuments().exec();
    if (count > 0) {
      logger.info('Las insignias ya están inicializadas');
      return;
    }

    const insigniasBase: Partial<IInsignia>[] = [
      {
        codigo: 'primera-vez',
        nombre: 'Primera Vez',
        descripcion: 'Crea tu primer evento',
        icono: '🎉',
        puntos: 25,
        criterios: { eventosCreadosRequeridos: 1 },
      },
      {
        codigo: 'social',
        nombre: 'Social',
        descripcion: 'Únete a 5 eventos',
        icono: '🤝',
        puntos: 50,
        criterios: { eventosUnidosRequeridos: 5 },
      },
      {
        codigo: 'critico',
        nombre: 'Crítico',
        descripcion: 'Deja 10 valoraciones',
        icono: '⭐',
        puntos: 75,
        criterios: { valoracionesRequeridas: 10 },
      },
      {
        codigo: 'popular',
        nombre: 'Popular',
        descripcion: 'Ten 10 amigos',
        icono: '👥',
        puntos: 60,
        criterios: { amigosRequeridos: 10 },
      },
      {
        codigo: 'organizador-pro',
        nombre: 'Organizador Pro',
        descripcion: 'Crea 10 eventos',
        icono: '🎯',
        puntos: 100,
        criterios: { eventosCreadosRequeridos: 10 },
      },
      {
        codigo: 'explorador',
        nombre: 'Explorador',
        descripcion: 'Únete a 20 eventos',
        icono: '🗺️',
        puntos: 120,
        criterios: { eventosUnidosRequeridos: 20 },
      },
      {
        codigo: 'centurion',
        nombre: 'Centurión',
        descripcion: 'Alcanza 1000 puntos',
        icono: '🏆',
        puntos: 200,
        criterios: { puntosRequeridos: 1000 },
      },
    ];

    await Insignia.insertMany(insigniasBase);
    logger.info('Insignias inicializadas correctamente');
  }
}

export default new GamificacionService();
