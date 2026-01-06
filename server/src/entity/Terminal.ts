import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("terminals")
export class Terminal {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'terminal_sn' })
    terminalSn!: string

    @Column({ name: 'terminal_key' })
    terminalKey!: string

    @Column({ name: 'device_id', unique: true })
    deviceId!: string

    @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
    activatedAt!: Date

    @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
    expiresAt!: Date

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
