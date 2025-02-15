import { Server } from 'http';
declare const initializeServices: (server: Server) => import("express-serve-static-core").Router;
export default initializeServices;
