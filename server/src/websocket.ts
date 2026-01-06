import { Server } from "http"
import { WebSocketServer, WebSocket } from "ws"
import url from "url"

export class WebSocketService {
    private static wss: WebSocketServer
    private static clients: Map<string, WebSocket> = new Map()

    static init(server: Server) {
        this.wss = new WebSocketServer({ server })

        this.wss.on("connection", (ws: WebSocket, req) => {
            const parameters = url.parse(req.url || "", true).query
            const clientSn = parameters.client_sn as string

            if (clientSn) {
                this.clients.set(clientSn, ws)
                console.log(`WebSocket connected: ${clientSn}`)

                ws.on("close", () => {
                    this.clients.delete(clientSn)
                    console.log(`WebSocket disconnected: ${clientSn}`)
                })

                ws.on("error", (error) => {
                    console.error(`WebSocket error for ${clientSn}:`, error)
                    this.clients.delete(clientSn)
                })
            } else {
                ws.close(1008, "client_sn required")
            }
        })

        console.log("WebSocket Server initialized")
    }

    static notifyPaymentSuccess(clientSn: string, data: any = {}) {
        const ws = this.clients.get(clientSn)
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "PAYMENT_SUCCESS",
                data: {
                    client_sn: clientSn,
                    ...data
                }
            }))
            console.log(`Notification sent for client_sn: ${clientSn}`)
            return true
        }
        return false
    }
}
