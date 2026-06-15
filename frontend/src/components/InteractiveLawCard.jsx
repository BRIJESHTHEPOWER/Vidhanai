import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FileText, AlertCircle } from 'lucide-react';

export default function InteractiveLawCard({ law, index, isComparing = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: index * 0.1 },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: { duration: 0.3 },
    },
  };

  const isOld = law.type === 'IPC';
  const cardColor = isOld ? 'var(--old-law)' : 'var(--new-law)';

  return (
    <motion.div
      className="law-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -5 }}
    >
      <div className="law-card-header">
        <div className="law-card-badge" style={{ borderLeftColor: cardColor }}>
          <FileText size={16} />
          <span>{law.type}</span>
        </div>
        <motion.button
          className="law-card-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          whileHover={{ rotate: 180 }}
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <ChevronDown size={20} />
        </motion.button>
      </div>

      <div className="law-card-content">
        <h4 className="law-card-title">{law.section}</h4>
        <p className="law-card-description">{law.title}</p>

        {isComparing && law.comparisonNote && (
          <div className="law-comparison-note">
            <AlertCircle size={16} />
            <span>{law.comparisonNote}</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="law-card-expanded"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <div className="law-card-divider" />
            <div className="law-card-details">
              <h5>Details</h5>
              <p>{law.details}</p>

              {law.keyPoints && (
                <div className="law-key-points">
                  <h6>Key Points:</h6>
                  <ul>
                    {law.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="law-card-actions">
                <motion.button
                  className="btn btn-small btn-outline"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Read Full Text
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
