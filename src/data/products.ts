import { Product } from '@/types/product';
import tshirtImg from '@/assets/tshirt.jpg';
import tracksuitImg from '@/assets/tracksuit.jpg';
import socksImg from '@/assets/socks.jpg';

export const products: Product[] = [
  {
    id: '1',
    name: 'School T-Shirt',
    school: 'Nairobi Primary School',
    type: 'tshirt',
    image: tshirtImg,
    sizes: [
      { size: 'XS', price: 450 },
      { size: 'S', price: 550 },
      { size: 'M', price: 650 },
      { size: 'L', price: 750 },
      { size: 'XL', price: 850 },
    ],
    inStock: true,
    description: 'Quality cotton school T-shirt with embroidered logo',
  },
  {
    id: '2',
    name: 'Sports Tracksuit',
    school: 'Nairobi Primary School',
    type: 'tracksuit',
    image: tracksuitImg,
    sizes: [
      { size: 'XS', price: 1200 },
      { size: 'S', price: 1250 },
      { size: 'M', price: 1300 },
      { size: 'L', price: 1350 },
      { size: 'XL', price: 1400 },
    ],
    inStock: true,
    description: 'Durable polyester tracksuit for PE and sports',
  },
  {
    id: '3',
    name: 'School Socks',
    school: 'All Schools',
    type: 'socks',
    image: socksImg,
    sizes: [
      { size: 'One Size', price: 150 },
    ],
    inStock: true,
    description: 'Quality cotton socks - 3 pairs pack',
  },
  {
    id: '4',
    name: 'School T-Shirt',
    school: 'Uhuru Academy',
    type: 'tshirt',
    image: tshirtImg,
    sizes: [
      { size: 'XS', price: 500 },
      { size: 'S', price: 600 },
      { size: 'M', price: 700 },
      { size: 'L', price: 800 },
      { size: 'XL', price: 900 },
    ],
    inStock: true,
    description: 'Premium quality school T-shirt',
  },
  {
    id: '5',
    name: 'Sports Tracksuit',
    school: 'Uhuru Academy',
    type: 'tracksuit',
    image: tracksuitImg,
    sizes: [
      { size: 'XS', price: 1500 },
      { size: 'S', price: 1550 },
      { size: 'M', price: 1600 },
      { size: 'L', price: 1650 },
      { size: 'XL', price: 1700 },
    ],
    inStock: true,
    description: 'High-quality tracksuit with school colors',
  },
  {
    id: '6',
    name: 'School Shorts',
    school: 'Nairobi Primary School',
    type: 'shorts',
    image: tshirtImg,
    sizes: [
      { size: 'XS', price: 350 },
      { size: 'S', price: 400 },
      { size: 'M', price: 450 },
      { size: 'L', price: 500 },
      { size: 'XL', price: 550 },
    ],
    inStock: true,
    description: 'Comfortable school shorts',
  },
  {
    id: '7',
    name: 'School Skirt',
    school: 'Uhuru Academy',
    type: 'skirt',
    image: tshirtImg,
    sizes: [
      { size: 'XS', price: 450 },
      { size: 'S', price: 500 },
      { size: 'M', price: 550 },
      { size: 'L', price: 600 },
      { size: 'XL', price: 650 },
    ],
    inStock: true,
    description: 'Quality pleated school skirt',
  },
  {
    id: '8',
    name: 'School Sweater',
    school: 'Nairobi Primary School',
    type: 'sweater',
    image: tracksuitImg,
    sizes: [
      { size: 'XS', price: 800 },
      { size: 'S', price: 900 },
      { size: 'M', price: 1000 },
      { size: 'L', price: 1100 },
      { size: 'XL', price: 1200 },
    ],
    inStock: true,
    description: 'Warm school sweater with logo',
  },
];

export const schools = [...new Set(products.map(p => p.school))];
export const uniformTypes = [...new Set(products.map(p => p.type))];
