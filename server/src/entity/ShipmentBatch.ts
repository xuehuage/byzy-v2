import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

@Entity("shipment_batches")
export class ShipmentBatch {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'school_id' })
    @Index()
    schoolId!: number

    @Column({ name: 'total_quantity', default: 0 })
    totalQuantity!: number

    @Column({ name: 'items_snapshot', type: 'json' })
    itemsSnapshot!: any

    @Column({ name: 'shipped_at', type: 'timestamp', nullable: true })
    shippedAt!: Date | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
