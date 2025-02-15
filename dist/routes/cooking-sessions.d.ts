import { Server } from 'http';
declare global {
    var server: Server;
}
declare const router: import("express-serve-static-core").Router;
export default router;
