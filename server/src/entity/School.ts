import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Product } from "./Product"
import { Class } from "./Class"

@Entity("schools")
export class School {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string

    @Column({ default: 1 })
    status!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @OneToMany(() => Product, (product) => product.school)
    products!: Product[]

    @OneToMany(() => Class, (cls) => cls.school)
    classes!: Class[]
}
