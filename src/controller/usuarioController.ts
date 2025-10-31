import { Request, Response } from 'express';
import { IUsuario } from '../models/usuario';
import { UserService } from '../services/usuarioServices';
import { validationResult } from 'express-validator';
import Usuario from '../models/usuario';
import { generateToken, generateRefreshToken } from '../auth/token';

const userService = new UserService();

export async function createUser(req: Request, res: Response): Promise<Response> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, gmail, password, birthday } = req.body as IUsuario;
    const newUser: Partial<IUsuario> = { username, gmail, password, birthday };
    const user = await userService.createUser(newUser);
    return res.status(201).json(user);
  } catch {
    return res.status(500).json({ error: 'FALLO AL CREAR EL USUARIO' });
  }
}

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10)); // límite máximo de 50
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.find().skip(skip).limit(limit).populate('eventos')
    ]);

    res.status(200).json({
      data: users,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error });
  }
};

export async function getUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}


export async function updateUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const userData: Partial<IUsuario> = req.body;
    const updatedUser = await userService.updateUserById(id, userData);
    if (!updatedUser) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function deleteUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const deletedUser = await userService.deleteUserById(id);
    if (!deletedUser) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(deletedUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}


export async function addEventToUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: 'Falta eventId' });
    const updated = await userService.addEventToUser(id, eventId);
    if (!updated) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
  /* Auxiliar function to eliminate the password of the user object */
function removePassword(user: any) {
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
}

/* Login */
export async function loginUser(req: Request, res: Response): Promise<Response> {
  console.log('login usuario');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, password } = req.body;
    
    const user = await userService.loginUser(username, password);
    if (!user) {
      return res.status(401).json({ 
        message: 'CREDENCIALES INCORRECTAS' 
      });
    }
    const token = await generateToken(user!, res);
    const refreshToken = await generateToken(user!, res);

    return res.status(200).json({
      message: 'LOGIN EXITOSO',
      user: removePassword(user),
      token,
      refreshToken
    });
  } catch (error) {
    return res.status(500).json({ error: 'ERROR EN EL LOGIN' });
  }
}

/* Create admin only development */
export async function createAdminUser(req: Request, res: Response): Promise<Response> {
  try {
    await userService.createAdminUser();
    return res.status(200).json({ message: 'Usuario admin verificado/creado' });
  } catch (error) {
    return res.status(500).json({ error: 'Error con usuario admin' });
  }
}

export const checkEmailExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gmail } = req.body;
    if (!gmail) {
      res.status(400).json({ exists: false, message: 'Correo no proporcionado' });
      return;
    }

    const existingUser = await Usuario.findOne({ gmail });
    if (existingUser) {
      res.status(200).json({ exists: true });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error('Error verificando correo:', error);
    res.status(500).json({ exists: false, message: 'Error en el servidor' });
  }
};

export async function disableUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params; // Obtenemos el ID de la URL

    // Llamamos al servicio para que haga la lógica de negocio
    const updatedUser = await userService.disableUser(id);

    // Si el servicio no encuentra el usuario, devolvemos un 404
    if (!updatedUser) {
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }

    // Si todo va bien, devolvemos el usuario actualizado
    return res.status(200).json(updatedUser);

  } catch (error) {
    // Manejo de cualquier otro error
    return res.status(500).json({ message: (error as Error).message });
  }

}
  
