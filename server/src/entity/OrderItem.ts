import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { Order } from "./Order"
import { Product } from "./Product"

@Entity("order_items")
export class OrderItem {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'order_id' })
    orderId!: number

    @Column({ name: 'product_id' })
    productId!: number

    @Column()
    quantity!: number

    @Column({ type: "int", name: 'price_snapshot', comment: "Price in cents" })
    priceSnapshot!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @ManyToOne(() => Order, (order) => order.items)
    @JoinColumn({ name: "order_id" })
    order!: Order

    @ManyToOne(() => Product)
    @JoinColumn({ name: "product_id" })
    product!: Product
}
