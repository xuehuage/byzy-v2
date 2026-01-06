import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { School } from "./School"

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'school_id' })
    schoolId!: number

    @Column()
    type!: number

    @Column()
    name!: string

    @Column({ type: "int", comment: "Price in cents" })
    price!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => School, (school) => school.products)
    @JoinColumn({ name: "school_id" })
    school!: School
}
