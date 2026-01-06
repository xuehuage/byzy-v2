import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Student } from "./Student"
import { OrderItem } from "./OrderItem"

export enum OrderStatus {
    PENDING = "PENDING",
    PAID = "PAID",
    CANCELLED = "CANCELLED"
}

@Entity("orders")
export class Order {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'student_id' })
    studentId!: number

    @Column({ name: 'order_no', unique: true })
    orderNo!: string

    @Column("decimal", { precision: 10, scale: 2, name: 'total_amount' })
    totalAmount!: number

    @Column({
        type: "enum",
        enum: OrderStatus,
        default: OrderStatus.PENDING
    })
    status!: OrderStatus

    @Column({ name: 'qr_code', nullable: true })
    qrCode!: string

    @Column({ name: 'transaction_id', nullable: true })
    transactionId!: string

    @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
    paidAt!: Date | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => Student)
    @JoinColumn({ name: "student_id" })
    student!: Student

    @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
    items!: OrderItem[]
}
