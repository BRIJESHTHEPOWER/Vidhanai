import React from 'react';
import { motion } from 'framer-motion';

export default function ScrollReveal({ 
  children, 
  delay = 0, 
  direction = 'up', 
  width = "100%", 
  duration = 0.8,
  distance = 50,
  amount = 0.1,
  className = ""
}) {
  const getVariants = () => {
    switch (direction) {
      case 'up': return { y: distance, x: 0 };
      case 'down': return { y: -distance, x: 0 };
      case 'left': return { x: distance, y: 0 };
      case 'right': return { x: -distance, y: 0 };
      default: return { y: distance, x: 0 };
    }
  };

  const startCoords = getVariants();

  const variants = {
    hidden: { 
      opacity: 0, 
      ...startCoords 
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      x: 0, 
      transition: { 
        duration, 
        delay, 
        ease: "easeOut" 
      } 
    }
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
      style={{ width }}
    >
      {children}
    </motion.div>
  );
}
