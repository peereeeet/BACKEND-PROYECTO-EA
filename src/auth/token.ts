import {sign, verify} from 'jsonwebtoken';
import {IUsuario} from '../models/usuario';
import type {Response} from 'express';

const JWT_SECRET = process.env.JWT_SECRET   || 'defaultsecret';
const JWT_refreshSECRET = process.env.JWT_refreshSECRET || 'defaultrefreshsecret';

const generateToken = (usuario: IUsuario, res: Response): string =>{
    const payload = { id: usuario._id.toString(), rol: usuario.rol };
    
const token : string = sign({payload}, JWT_SECRET, {expiresIn: "1d"});

return token;
};
const generateRefreshToken = (usuario: IUsuario, res: Response): string =>{
    const payload = { id: usuario._id.toString(), rol : usuario.rol }; 
    const refreshToken : string = sign({payload}, JWT_refreshSECRET, {expiresIn: "1w"});

return refreshToken;
}       

const verifyToken = (token : string) =>{
    try {
        const decoded = verify(token, JWT_SECRET);
        return decoded;
} 
    catch (error) {
        return null;
}  
};
const verifyRefreshToken = (refreshToken : string) =>{
    try {
        const decoded = verify(refreshToken, JWT_refreshSECRET);
        return decoded;
} 
    catch (error) {
        return null;
    }
}   
export{generateToken, verifyToken, generateRefreshToken, verifyRefreshToken}; 