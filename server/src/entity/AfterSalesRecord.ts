import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Order } from "./Order"

export enum AfterSalesType {
    EXCHANGE = "EXCHANGE",
    REFUND = "REFUND"
}

export enum AfterSalesStatus {
    PENDING = "PENDING",
    PROCESSED = "PROCESSED",
    REJECTED = "REJECTED"
}

@Entity("after_sales_records")
export class AfterSalesRecord {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'order_id' })
    orderId!: number

    @Column({
        type: "enum",
        enum: AfterSalesType
    })
    type!: AfterSalesType

    @Column({
        type: "enum",
        enum: AfterSalesStatus,
        default: AfterSalesStatus.PENDING
    })
    status!: AfterSalesStatus

    @Column({ name: 'original_quantity' })
    originalQuantity!: number

    @Column({ name: 'original_size', length: 50 })
    originalSize!: string

    @Column({ name: 'new_quantity' })
    newQuantity!: number

    @Column({ name: 'new_size', type: "varchar", length: 50, nullable: true })
    newSize!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => Order)
    @JoinColumn({ name: "order_id" })
    order!: Order
}
