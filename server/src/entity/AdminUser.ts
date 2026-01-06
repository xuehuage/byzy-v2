import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("admin_users")
export class AdminUser {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    username!: string

    @Column({ name: 'password_hash' })
    passwordHash!: string

    @Column()
    realname!: string

    @Column({ name: 'login_retries', default: 0 })
    loginRetries!: number

    @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
    lockedUntil!: Date | null

    @Column({ name: 'two_factor_secret', type: 'varchar', nullable: true })
    twoFactorSecret!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
