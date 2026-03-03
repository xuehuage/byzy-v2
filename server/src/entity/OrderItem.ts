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

    @Column({ type: "varchar", nullable: true })
    size!: string | null

    @Column({ name: 'is_special_size', type: 'tinyint', default: 0 })
    isSpecialSize!: boolean

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    height!: number | null

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    weight!: number | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @ManyToOne(() => Order, (order) => order.items)
    @JoinColumn({ name: "order_id" })
    order!: Order

    @ManyToOne(() => Product)
    @JoinColumn({ name: "product_id" })
    product!: Product
}
