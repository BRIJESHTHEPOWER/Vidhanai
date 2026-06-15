import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Sparkles, AlertTriangle, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

export default function ImmersiveIntro({ onComplete }) {
  const [scene, setScene] = useState(1);

  // Auto-advance scenes if user doesn't interact (creates a cinematic flow)
  useEffect(() => {
    let timer;
    if (scene === 1) timer = setTimeout(() => setScene(2), 4000);
    else if (scene === 2) timer = setTimeout(() => setScene(3), 4000);
    else if (scene === 3) timer = setTimeout(() => setScene(4), 5000);
    else if (scene === 4) timer = setTimeout(() => setScene(5), 3000);
    else if (scene === 5) {
      // Trigger completion after a brief moment to allow out-animation
      timer = setTimeout(() => onComplete(), 800);
    }
    return () => clearTimeout(timer);
  }, [scene, onComplete]);

  // Framer Motion variants
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.6, ease: 'easeIn' } }
  };

  const slowZoom = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 1.05, transition: { duration: 0.8, ease: 'easeIn' } }
  };

  const orbBreathing = {
    animate: {
      scale: [1, 1.05, 1],
      boxShadow: [
        '0 0 40px rgba(0, 200, 83, 0.4)',
        '0 0 60px rgba(0, 200, 83, 0.6)',
        '0 0 40px rgba(0, 200, 83, 0.4)'
      ],
      transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
    }
  };

  const nodeVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: i => ({
      opacity: 1, scale: 1,
      transition: { delay: i * 0.8, duration: 0.6, ease: 'easeOut' }
    })
  };

  return (
    <motion.div 
      className="immersive-intro-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: scene === 5 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="intro-content">
        <AnimatePresence mode="wait">
          
          {/* ================= SCENE 1 ================= */}
          {scene === 1 && (
            <motion.div key="scene1" className="scene-container" variants={slowZoom} initial="hidden" animate="visible" exit="exit">
              <motion.div className="icon-wrapper confused" variants={fadeUp}>
                <HelpCircle size={80} strokeWidth={1.5} color="#86a98c" />
              </motion.div>
              <motion.div className="text-wrapper" variants={fadeUp}>
                <div className="problem-bubble">
                  <AlertTriangle size={18} color="#f59e0b" />
                  <span>"My phone was stolen. I don't understand the law..."</span>
                </div>
                <h2 className="scene-heading mt-4">Don't worry. We'll guide you.</h2>
              </motion.div>
            </motion.div>
          )}

          {/* ================= SCENE 2 ================= */}
          {scene === 2 && (
            <motion.div key="scene2" className="scene-container" initial="hidden" animate="visible" exit="exit" variants={fadeUp}>
              <motion.div className="orb-wrapper" variants={orbBreathing} animate="animate">
                <Sparkles size={50} color="#00c853" />
              </motion.div>
              <motion.div className="text-wrapper mt-4">
                <h2 className="scene-heading text-primary glow-text">Hi, I am Vidhan.ai.</h2>
                <p className="scene-sub">Your personal, friendly legal guide. No complex words.</p>
              </motion.div>
            </motion.div>
          )}

          {/* ================= SCENE 3 ================= */}
          {scene === 3 && (
            <motion.div key="scene3" className="scene-container story-flow" initial="hidden" animate="visible" exit="exit" variants={slowZoom}>
              <h2 className="scene-heading mb-4">We make the law a simple story.</h2>
              
              <div className="nodes-container">
                <motion.div className="story-node" custom={0} variants={nodeVariants} initial="hidden" animate="visible">
                  <div className="node-icon"><FileText size={24} /></div>
                  <span>1. Report</span>
                </motion.div>

                <motion.div className="story-line" initial={{ width: 0 }} animate={{ width: 40 }} transition={{ delay: 0.8, duration: 0.5 }} />

                <motion.div className="story-node" custom={1} variants={nodeVariants} initial="hidden" animate="visible">
                  <div className="node-icon"><HelpCircle size={24} /></div>
                  <span>2. Details</span>
                </motion.div>

                <motion.div className="story-line" initial={{ width: 0 }} animate={{ width: 40 }} transition={{ delay: 1.6, duration: 0.5 }} />

                <motion.div className="story-node" custom={2} variants={nodeVariants} initial="hidden" animate="visible">
                  <div className="node-icon final"><ShieldCheck size={24} color="#00c853" /></div>
                  <span className="text-primary">3. Protected</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ================= SCENE 4 ================= */}
          {scene === 4 && (
            <motion.div key="scene4" className="scene-container resolution" initial="hidden" animate="visible" exit="exit" variants={slowZoom}>
              <motion.div className="icon-wrapper success" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}>
                <CheckCircle2 size={90} color="#00c853" />
              </motion.div>
              <motion.div className="text-wrapper mt-4" variants={fadeUp}>
                <h2 className="scene-heading">Now you understand your rights.</h2>
                <p className="scene-sub">Knowledge brings confidence.</p>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Keep Skip button visible during scenes 1 to 4 */}
      {scene < 5 && (
        <button className="skip-intro-btn" onClick={() => setScene(5)}>
          Skip Intro →
        </button>
      )}
    </motion.div>
  );
}
