import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  fetchCatalog,
  fetchCampaigns,
  submitBasket,
  createCampaign,
  fetchTeamAnalytics,
  uploadImage,
  formatImageUrl
} from './api';
import logoImg from './assets/logo.png';

const DEFAULT_WHATSAPP_NUMBER = '233593800950';

// Real Ghanaian neighborhood coordinate seeds for logistics map
const ACCRA_NEIGHBORHOODS = [
  { name: 'Airport Residential', lat: 5.6085, lng: -0.1795, x: 55, y: 35 },
  { name: 'East Legon', lat: 5.6322, lng: -0.1654, x: 75, y: 20 },
  { name: 'Osu Oxford St', lat: 5.5583, lng: -0.1833, x: 50, y: 75 },
  { name: 'Labone', lat: 5.5685, lng: -0.1685, x: 65, y: 65 },
  { name: 'Cantonments', lat: 5.5845, lng: -0.1712, x: 60, y: 50 },
  { name: 'Dzorwulu', lat: 5.6120, lng: -0.2015, x: 30, y: 40 }
];

// Pre-seeded boutiques center coordinates
const BOUTIQUE_LAT = 5.6037;
const BOUTIQUE_LNG = -0.1870;
const BOUTIQUE_X = 45; // percentage on map SVG
const BOUTIQUE_Y = 48;

// Available courier seeds
const COURIERS_LIST = [
  { id: 'rider-1', name: 'Kojo Mall Rider', lat: 5.6213, lng: -0.1735, startX: 65, startY: 28, currentX: 65, currentY: 28 },
  { id: 'rider-2', name: 'Yaw Osu Dispatch', lat: 5.5502, lng: -0.1901, startX: 42, startY: 82, currentX: 42, currentY: 82 },
  { id: 'rider-3', name: 'Akosua Cantonments', lat: 5.5790, lng: -0.1601, startX: 72, startY: 55, currentX: 72, currentY: 55 }
];

// Mathematical Haversine proximity function
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  // Data lists
  const [catalog, setCatalog] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cart & Checkout
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('0593800950');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [whatsappMerchantNumber, setWhatsappMerchantNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  
  // Custom Detail/Personalization Modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customInitials, setCustomInitials] = useState('');
  const [tailoringNote, setTailoringNote] = useState('');

  // -------------------------------------------------------------
  // Fitting Room Chatbot States
  // -------------------------------------------------------------
  const [isFittingRoomActive, setIsFittingRoomActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatStep, setChatStep] = useState(0); // 0: Init, 1: Chest, 2: Waist, 3: Hips, 4: Calculation, 5: Completed
  const [inputVal, setInputVal] = useState('');
  const [tempMetrics, setTempMetrics] = useState({ chest: null, waist: null, hips: null });
  const [chatbotFitScore, setChatbotFitScore] = useState(null);
  const [chatbotSizeLabel, setChatbotSizeLabel] = useState(null);
  
  // Ref for chatbot scroll pinning
  const chatScrollRef = useRef(null);

  // -------------------------------------------------------------
  // Logistics Engine & Map Dashboard States
  // -------------------------------------------------------------
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState('analytics'); // analytics, logistics, campaigns
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [refreshAnalytics, setRefreshAnalytics] = useState(0);
  
  // Map Courier Dispatch states
  const [couriers, setCouriers] = useState(COURIERS_LIST);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState('');
  const [dispatchDistance, setDispatchDistance] = useState(0);
  const [dispatchLocationName, setDispatchLocationName] = useState('');

  // Dispatch GSAP animate targets
  const riderRef = useRef(null);
  const pathRef = useRef(null);

  // New Campaign Form
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignCopy, setCampaignCopy] = useState('');
  const [campaignImageFile, setCampaignImageFile] = useState(null);
  const [campaignFeaturedIds, setCampaignFeaturedIds] = useState([]);

  // Toast System state
  const [toasts, setToasts] = useState([]);

  // Helper to trigger custom luxury toasts
  const triggerToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 1. Initial Load: Fetch Catalog and Campaigns
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [catalogData, campaignsData] = await Promise.all([
          fetchCatalog(),
          fetchCampaigns()
        ]);
        setCatalog(catalogData);
        setCampaigns(campaignsData);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Unable to connect to the Coded Matrix API.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // 2. Fetch live team statistics when admin dashboard opens
  useEffect(() => {
    if (isAdminOpen) {
      async function loadAnalytics() {
        try {
          const stats = await fetchTeamAnalytics();
          setTeamAnalytics(stats);
        } catch (err) {
          console.error('Failed to load team analytics:', err);
          triggerToast('Error loading live admin data.');
        }
      }
      loadAnalytics();
    }
  }, [isAdminOpen, refreshAnalytics]);

  // 3. Scroll pinning inside Chatbot Fitting Room
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // -------------------------------------------------------------
  // GSAP-Animated Fitting Room Chatbot Logic
  // -------------------------------------------------------------
  const initFittingChat = () => {
    setIsFittingRoomActive(true);
    setChatStep(1);
    setTempMetrics({ chest: null, waist: null, hips: null });
    setChatbotFitScore(null);
    setChatbotSizeLabel(null);
    setChatMessages([
      {
        id: 1,
        sender: 'bot',
        text: 'Greetings. I am your Mensah digital tailor. Let\'s coordinate your bespoke parameters for a perfect silhouette.'
      },
      {
        id: 2,
        sender: 'bot',
        text: 'First, what is your chest circumference in cm? (Typically 80cm - 130cm)'
      }
    ]);
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal.trim();
    const userVal = parseFloat(userText);
    setInputVal('');

    // Append user message bubble with GSAP target
    const userMsgId = Date.now();
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);

    // Trigger smooth fade-in for new message bubble using GSAP
    setTimeout(() => {
      gsap.fromTo(`#msg-${userMsgId}`, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }, 50);

    // Chatbot conversational steps
    if (chatStep === 1) {
      // Validate Chest
      if (isNaN(userVal) || userVal < 50 || userVal > 180) {
        appendBotMessage('I request a valid measurement. Please supply your chest size in cm (e.g. 96).');
        return;
      }
      setTempMetrics(prev => ({ ...prev, chest: userVal }));
      setChatStep(2);
      setTimeout(() => {
        appendBotMessage('Understood. Next, what is your natural waist circumference in cm? (e.g. 70cm - 120cm)');
      }, 600);

    } else if (chatStep === 2) {
      // Validate Waist
      if (isNaN(userVal) || userVal < 40 || userVal > 180) {
        appendBotMessage('Please supply a valid waist coordinate in cm.');
        return;
      }
      setTempMetrics(prev => ({ ...prev, waist: userVal }));
      setChatStep(3);
      setTimeout(() => {
        appendBotMessage('Almost complete. Lastly, what is your maximum hip circumference in cm? (e.g. 80cm - 135cm)');
      }, 600);

    } else if (chatStep === 3) {
      // Validate Hips
      if (isNaN(userVal) || userVal < 50 || userVal > 180) {
        appendBotMessage('Please enter a valid hip coordinate in cm.');
        return;
      }
      const updatedMetrics = { ...tempMetrics, hips: userVal };
      setTempMetrics(updatedMetrics);
      setChatStep(4);
      
      setTimeout(() => {
        appendBotMessage('Excellent. Executing dimensional matching algorithm on our tailoring server...');
        calculateChatbotFitting(updatedMetrics);
      }, 600);
    }
  };

  const appendBotMessage = (text) => {
    const msgId = Date.now();
    setChatMessages(prev => [...prev, { id: msgId, sender: 'bot', text }]);
    setTimeout(() => {
      gsap.fromTo(`#msg-${msgId}`, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }, 50);
  };

  // Calculates sizing fit score & coordinates in client-side JS
  const calculateChatbotFitting = (metrics) => {
    setTimeout(() => {
      // Standard matching matrices
      const averageMetric = (metrics.chest + metrics.waist + metrics.hips) / 3;
      let finalLabel = 'Bespoke M';
      let matchingScore = 95;

      if (averageMetric < 85) {
        finalLabel = 'Tailored S';
        matchingScore = 92;
      } else if (averageMetric < 98) {
        finalLabel = 'Tailored M';
        matchingScore = 97;
      } else if (averageMetric < 112) {
        finalLabel = 'Bespoke L';
        matchingScore = 94;
      } else {
        finalLabel = 'Sartorial XL';
        matchingScore = 89;
      }

      // Add adjustments depending on fit select
      const scoreTag = `${matchingScore}% Silhouette Match`;
      const sizeTag = `${finalLabel} (${fitPreference.toUpperCase()})`;

      setChatbotFitScore(scoreTag);
      setChatbotSizeLabel(sizeTag);
      setChatStep(5);

      appendBotMessage(`Dimensional matching completed successfully! We recommend: ${sizeTag}.`);
      appendBotMessage(`Your silhouette match score is ${scoreTag}. Tap "Apply Tailoring" below to bind these parameters to your order.`);
    }, 1500);
  };

  const applyFittingToNote = () => {
    if (!chatbotSizeLabel) return;
    
    // Auto-update tailoring fields
    const chatSummary = `Calculated Sizing: ${chatbotSizeLabel}. (Chest: ${tempMetrics.chest}cm, Waist: ${tempMetrics.waist}cm, Hips: ${tempMetrics.hips}cm). Match: ${chatbotFitScore}.`;
    setTailoringNote(chatSummary);
    setIsFittingRoomActive(false);
    triggerToast('Fitting coordinates successfully applied to your tailored details!');
  };

  // -------------------------------------------------------------
  // GSAP-Animated Spatial Courier Logistics Matcher (Admin)
  // -------------------------------------------------------------
  const handleAutoDispatch = (deliveryBasket) => {
    if (isDispatching) return;
    setSelectedDelivery(deliveryBasket);
    setIsDispatching(true);

    // 1. Pick a random Accra neighborhood destination coordinate
    const destNeighborhood = ACCRA_NEIGHBORHOODS[Math.floor(Math.random() * ACCRA_NEIGHBORHOODS.length)];
    setDispatchLocationName(destNeighborhood.name);

    setDispatchStatusMsg('Initiating Haversine spatial proximity analysis...');

    // 2. Loop couriers list, run Haversine matching coordinates, select closest one
    let closestCourier = null;
    let minDistance = Infinity;

    couriers.forEach(courier => {
      const dist = haversineDistance(courier.lat, courier.lng, BOUTIQUE_LAT, BOUTIQUE_LNG);
      if (dist < minDistance) {
        minDistance = dist;
        closestCourier = courier;
      }
    });

    setDispatchDistance(minDistance);

    // 3. Initiate step-by-step GSAP timelines for dispatch animations
    setTimeout(() => {
      setDispatchStatusMsg(`Spatial match: ${closestCourier.name} is closest (${minDistance.toFixed(2)} km away). Dispatching rider to Boutique...`);

      // GSAP Animation Step A: Animate Courier dot from start coordinates to Boutique central
      const tl = gsap.timeline({
        onComplete: () => {
          setDispatchStatusMsg('Package picked up at Mensah Boutique. Easing delivery route to customer...');
          
          // GSAP Animation Step B: Animate Courier dot from Boutique central to destination neighborhood pin
          gsap.to(`#courier-${closestCourier.id}`, {
            left: `${destNeighborhood.x}%`,
            top: `${destNeighborhood.y}%`,
            duration: 3.5,
            ease: 'sine.inOut',
            onComplete: () => {
              setDispatchStatusMsg(`Order ${deliveryBasket.id} delivered successfully to ${destNeighborhood.name}!`);
              setIsDispatching(false);
              triggerToast(`Delivery confirmed to ${destNeighborhood.name}!`);
              
              // Restore courier position
              setTimeout(() => {
                setCouriers(prev => prev.map(c => 
                  c.id === closestCourier.id 
                    ? { ...c, currentX: destNeighborhood.x, currentY: destNeighborhood.y, lat: destNeighborhood.lat, lng: destNeighborhood.lng }
                    : c
                ));
              }, 500);
            }
          });
        }
      });

      // Move courier dot from start to boutique
      tl.to(`#courier-${closestCourier.id}`, {
        left: `${BOUTIQUE_X}%`,
        top: `${BOUTIQUE_Y}%`,
        duration: 2.2,
        ease: 'power1.inOut'
      });

    }, 1200);
  };

  // -------------------------------------------------------------
  // Standard Store Actions
  // -------------------------------------------------------------
  const openPersonalization = (product) => {
    setSelectedProduct(product);
    setTailoringNote('');
    setCustomInitials('');
    setQuantity(1);
    setIsFittingRoomActive(false);
    setChatStep(0);
  };

  const closePersonalization = () => {
    setSelectedProduct(null);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    let combinedNote = '';
    if (customInitials.trim()) {
      combinedNote += `Gold Monogram: "${customInitials.toUpperCase()}". `;
    }
    if (tailoringNote.trim()) {
      combinedNote += `${tailoringNote.trim()}`;
    }

    const cartItem = {
      ...selectedProduct,
      qty: quantity,
      note: combinedNote.trim(),
      uniqueCartId: `${selectedProduct.id}-${Date.now()}`
    };

    setCart(prev => [...prev, cartItem]);
    closePersonalization();
    triggerToast(`Added ${selectedProduct.name} to your tailored basket.`);
    setIsCartOpen(true);
  };

  const updateCartQty = (uniqueCartId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.uniqueCartId === uniqueCartId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (uniqueCartId) => {
    setCart(prev => prev.filter(item => item.uniqueCartId !== uniqueCartId));
    triggerToast('Removed item from basket.');
  };

  const getBasketTotalMinor = () => {
    return cart.reduce((total, item) => total + (item.price_minor * item.qty), 0);
  };

  // Checkout with WhatsApp Link
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    try {
      triggerToast('Registering custom order with merchant database...');
      
      const basketPayload = {
        items: cart,
        customerName: checkoutName,
        customerPhone: checkoutPhone,
        customerNote: checkoutNote
      };

      const result = await submitBasket(basketPayload);
      const basketId = result.id;
      
      triggerToast('Order verified! Launching secure WhatsApp link...');

      const totalCedis = (getBasketTotalMinor() / 100).toFixed(2);
      const itemsSummary = cart.map(item => {
        let line = `- ${item.qty}x ${item.name} (GHS ${(item.price_minor / 100).toFixed(2)} each)`;
        if (item.note) {
          line += `\n  ↳ ${item.note}`;
        }
        return line;
      }).join('\n');

      const whatsappText = `👔 *MENSAH | Bespoke Tailoring Order Confirmation*
----------------------------------
*Order Reference:* ${basketId}
*Customer Details:*
• Name: ${checkoutName || 'Valued Client'}
• Phone: ${checkoutPhone || 'Not Specified'}
• Special Instructions: ${checkoutNote || 'None'}

*Custom Items:*
${itemsSummary}

----------------------------------
*Grand Total:* GHS ${totalCedis}

*Verify Live Details:*
${formatImageUrl(`/baskets/${basketId}`)}
----------------------------------
_Thank you for choosing sartorial excellence._`;

      const encodedMsg = encodeURIComponent(whatsappText);
      const targetPhone = whatsappMerchantNumber.replace(/[^0-9+]/g, '');
      const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodedMsg}`;

      setCart([]);
      setIsCartOpen(false);
      
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 1000);

    } catch (err) {
      console.error(err);
      triggerToast(err.message || 'Checkout failed.');
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!campaignTitle.trim()) return;

    try {
      triggerToast('Publishing lookbook campaign...');
      let imageUrls = [];

      if (campaignImageFile) {
        const uploadRes = await uploadImage(campaignImageFile);
        imageUrls.push(uploadRes.url);
      } else {
        imageUrls.push('/images/mensah/logo.png');
      }

      const campaignPayload = {
        title: campaignTitle.trim(),
        copyText: campaignCopy.trim(),
        imageUrls: imageUrls,
        featuredItemIds: campaignFeaturedIds
      };

      await createCampaign(campaignPayload);
      triggerToast('New lookbook drop published!');
      
      setCampaignTitle('');
      setCampaignCopy('');
      setCampaignImageFile(null);
      setCampaignFeaturedIds([]);
      setRefreshAnalytics(prev => prev + 1);

      const freshCampaigns = await fetchCampaigns();
      setCampaigns(freshCampaigns);
    } catch (err) {
      console.error(err);
      triggerToast(err.message || 'Failed to publish Lookbook.');
    }
  };

  return (
    <>
      {/* Toast Alert popups */}
      <div className="toast-container" id="global-toasts">
        {toasts.map(t => (
          <div key={t.id} className="toast" id={`toast-${t.id}`}>
            <span style={{ color: 'var(--color-gold)' }}>✦</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header Panel */}
      <header className="main-header" id="nav-header">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logoImg} alt="MENSAH logo" className="logo-img" />
          </div>

          <div className="nav-actions">
            <button 
              className="btn-gold" 
              id="btn-admin-drawer" 
              onClick={() => setIsAdminOpen(true)}
            >
              ⚜ Portal Admin
            </button>
            <button 
              className="btn-gold" 
              id="btn-cart-drawer" 
              onClick={() => setIsCartOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>🛒 Basket</span>
              {cart.length > 0 && (
                <span style={{
                  background: 'var(--color-gold)',
                  color: 'var(--bg-primary)',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '50%',
                  fontWeight: '700'
                }}>
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main>
        {/* Luxury Hero Banner */}
        <section className="hero-showcase" id="hero-banner">
          <div className="container">
            <span className="hero-subtitle">✦ Sartorial Excellence & Tailoring ✦</span>
            <h1 className="hero-title">Bespoke luxury cut to your perfect fit.</h1>
            <p className="hero-desc">
              Impeccable structure, timeless designs, and contemporary West African aesthetics. Tailored specifically for the modern global gentleman.
            </p>
            <button 
              className="btn-gold-solid" 
              onClick={() => {
                document.getElementById('inventory-catalog').scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Explore Collection
            </button>
          </div>
        </section>

        {/* Dynamic Lookbook Campaigns Carousel */}
        {campaigns.length > 0 && (
          <section className="lookbook-section" id="lookbook-drops">
            <div className="container">
              <h2 className="lookbook-title">The Lookbooks</h2>
              <p className="lookbook-subtitle">
                Explore our curated style collections. Click on any outfit tags inside a drop to preview custom sizing choices and order directly.
              </p>
              
              <div className="lookbook-carousel" id="lookbooks-scroll">
                {campaigns.map(camp => (
                  <div key={camp.id} className="lookbook-slide" id={`campaign-${camp.id}`}>
                    <div className="lookbook-slide-image">
                      <img 
                        src={camp.image_urls && camp.image_urls.length > 0 ? formatImageUrl(camp.image_urls[0]) : logoImg} 
                        alt={camp.title} 
                      />
                    </div>
                    <div className="lookbook-slide-content">
                      <span className="lookbook-slide-tag">✦ Drop Release ✦</span>
                      <h3 className="lookbook-slide-title">{camp.title}</h3>
                      {camp.copy_text && (
                        <p className="lookbook-slide-copy">{camp.copy_text}</p>
                      )}
                      
                      {camp.team_slug === 'likekodji' && (
                        <div style={{ marginTop: 'auto' }}>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Featured Outfits:
                          </span>
                          <div className="featured-items-list">
                            {catalog.map(prod => (
                              <span 
                                key={prod.id} 
                                className="featured-item-tag"
                                onClick={() => openPersonalization(prod)}
                              >
                                {prod.name} ✦
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Catalog Showcase Grid */}
        <section className="container" id="inventory-catalog" style={{ padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
              ✦ Ready to Tailor ✦
            </span>
            <h2 style={{ fontSize: '2.5rem', marginTop: '8px' }}>Bespoke Catalog</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '550px', margin: '12px auto 0' }}>
              Browse through our preloaded collection. Select any outfit to initiate bespoke tailor modifications and calculate your sizing coordinates.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: '1.25rem', color: 'var(--color-gold)' }}>✦ Restoring Inventory Files...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '1px solid rgba(255,0,0,0.2)', background: 'rgba(255,0,0,0.05)' }}>
              <p style={{ color: '#ff6b6b' }}>{error}</p>
              <button className="btn-gold" style={{ marginTop: '16px' }} onClick={() => window.location.reload()}>Retry Connection</button>
            </div>
          ) : (
            <div className="products-grid">
              {catalog.map(prod => (
                <div key={prod.id} className="product-card" id={`product-${prod.id}`}>
                  <div className="product-image-container">
                    <img 
                      src={prod.image_urls && prod.image_urls.length > 0 ? formatImageUrl(prod.image_urls[0]) : logoImg} 
                      alt={prod.name} 
                      className="product-image"
                      loading="lazy"
                    />
                    <span className={`product-badge ${prod.in_stock ? '' : 'out'}`}>
                      {prod.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                  <div className="product-info">
                    <h3 className="product-name">{prod.name}</h3>
                    <p className="product-desc">
                      {prod.description || 'Premium custom suit designed from heavy cotton and double lining.'}
                    </p>
                    <div className="product-price-row">
                      <span className="product-price">GHS {(prod.price_minor / 100).toFixed(2)}</span>
                      <button 
                        className="btn-gold" 
                        disabled={!prod.in_stock}
                        onClick={() => openPersonalization(prod)}
                      >
                        {prod.in_stock ? 'Bespoke Order' : 'Unavailable'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Sizing & Tailoring Personalization Modal */}
      {selectedProduct && (
        <div className="modal-overlay active" id="tailor-modal-overlay">
          <div className="modal-content" style={{ maxWidth: isFittingRoomActive ? '900px' : '850px' }}>
            <button className="modal-close" onClick={closePersonalization}>✕</button>
            
            <div className="modal-grid" style={{ gridTemplateColumns: isFittingRoomActive ? '1fr 1.2fr' : '1.1fr 1.3fr' }}>
              {/* Product preview */}
              <div className="modal-image-panel" style={{ display: isFittingRoomActive ? 'none' : 'block' }}>
                <img 
                  src={selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? formatImageUrl(selectedProduct.image_urls[0]) : logoImg} 
                  alt={selectedProduct.name} 
                />
              </div>

              {/* Chatbot Fitting Room Panel (Option A React Hybrid) */}
              {isFittingRoomActive && (
                <div style={{ padding: '32px', borderRight: '1px solid var(--border-grey)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', items: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)' }}>🤖 Virtual Fitting Chat</h3>
                    <button 
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', fontSize: '0.75rem' }}
                      onClick={() => setIsFittingRoomActive(false)}
                    >
                      ✕ Exit Chat
                    </button>
                  </div>

                  <div className="fitting-bot-panel">
                    <div className="fitting-bot-messages" ref={chatScrollRef}>
                      {chatMessages.map(msg => (
                        <div 
                          key={msg.id} 
                          id={`msg-${msg.id}`} 
                          className={`msg-bubble ${msg.sender}`}
                        >
                          {msg.text}
                        </div>
                      ))}
                    </div>

                    {/* Chat steps metric badge indicators */}
                    <div style={{ padding: '0 12px', background: '#111' }}>
                      {tempMetrics.chest && <span className="fitting-metric-badge">Chest: {tempMetrics.chest}cm</span>}
                      {tempMetrics.waist && <span className="fitting-metric-badge">Waist: {tempMetrics.waist}cm</span>}
                      {tempMetrics.hips && <span className="fitting-metric-badge">Hips: {tempMetrics.hips}cm</span>}
                    </div>

                    {/* Interactive chat input area */}
                    <form className="fitting-bot-input-area" onSubmit={handleSendChatMessage}>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ flexGrow: 1, border: 'none', background: 'transparent' }}
                        placeholder={chatStep < 4 ? "Type size in cm and press Enter..." : "Calculating..."}
                        disabled={chatStep >= 4}
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        className="btn-gold" 
                        style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                        disabled={chatStep >= 4}
                      >
                        Send
                      </button>
                    </form>
                  </div>

                  {chatbotSizeLabel && (
                    <button 
                      className="btn-gold-solid" 
                      style={{ marginTop: '16px', width: '100%' }}
                      onClick={applyFittingToNote}
                    >
                      ✦ Apply Tailoring coordinates
                    </button>
                  )}
                </div>
              )}

              {/* Personalization Options */}
              <div className="modal-details-panel">
                <span style={{ color: 'var(--color-gold)', letterSpacing: '0.1em', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Bespoke Customization
                </span>
                <h2 style={{ fontSize: '1.8rem', margin: '4px 0 12px' }}>{selectedProduct.name}</h2>
                
                {!isFittingRoomActive && (
                  <>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                      To guarantee structural excellence, integrate our **AI Virtual Fitting Room** to chat with our digital tailor, calculate size coordinates, and lock chest, waist, and hips metrics.
                    </p>

                    <button 
                      className="btn-gold-solid" 
                      style={{ marginBottom: '24px', width: '100%', background: 'transparent', color: 'var(--color-gold)' }}
                      onClick={initFittingChat}
                    >
                      🤖 Launch AI Virtual Fitting Room
                    </button>
                  </>
                )}

                {/* Manual bespoke entries */}
                <div className="form-group">
                  <label htmlFor="input-initials">Gold Thread Initials Monogram (Optional)</label>
                  <input 
                    type="text" 
                    id="input-initials"
                    className="form-control" 
                    placeholder="e.g. JM" 
                    maxLength={3}
                    value={customInitials}
                    onChange={(e) => setCustomInitials(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="input-tailor-note">Measurement Adjustments or Request Notes</label>
                  <textarea 
                    id="input-tailor-note"
                    className="form-control" 
                    rows={3} 
                    placeholder="e.g. Sleeve length 64cm, collar 41cm..."
                    value={tailoringNote}
                    onChange={(e) => setTailoringNote(e.target.value)}
                  />
                </div>

                {/* Quantity and Submit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-grey)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      className="btn-gold" 
                      style={{ padding: '4px 12px', minWidth: '32px' }}
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', width: '20px', textAlign: 'center' }}>{quantity}</span>
                    <button 
                      className="btn-gold" 
                      style={{ padding: '4px 12px', minWidth: '32px' }}
                      onClick={() => setQuantity(prev => prev + 1)}
                    >
                      +
                    </button>
                  </div>

                  <button 
                    className="btn-gold-solid" 
                    style={{ flexGrow: 1 }}
                    onClick={handleAddToCart}
                  >
                    Commit to Basket • GHS {((selectedProduct.price_minor * quantity) / 100).toFixed(2)}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Slide-out Cart Drawer */}
      <div className={`cart-drawer ${isCartOpen ? 'active' : ''}`} id="shopping-cart-drawer">
        <div className="cart-header">
          <h3 style={{ fontSize: '1.35rem' }}>Your Sartorial Basket</h3>
          <button className="modal-close" style={{ position: 'static' }} onClick={() => setIsCartOpen(false)}>✕</button>
        </div>

        <div className="cart-items-container">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🛍</span>
              <p>Your luxury basket is currently empty.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uniqueCartId} className="cart-item" id={`cart-item-${item.id}`}>
                <div className="cart-item-image">
                  <img src={item.image_urls && item.image_urls.length > 0 ? formatImageUrl(item.image_urls[0]) : logoImg} alt={item.name} />
                </div>
                <div className="cart-item-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 className="cart-item-name">{item.name}</h4>
                    <button 
                      style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '0.8rem' }}
                      onClick={() => removeFromCart(item.uniqueCartId)}
                    >
                      Remove
                    </button>
                  </div>
                  <span className="cart-item-price">GHS {(item.price_minor / 100).toFixed(2)}</span>
                  
                  {item.note && (
                    <span className="cart-item-note">{item.note}</span>
                  )}
                  
                  <div className="cart-item-qty">
                    <button onClick={() => updateCartQty(item.uniqueCartId, -1)}>-</button>
                    <span style={{ fontSize: '0.85rem' }}>{item.qty}</span>
                    <button onClick={() => updateCartQty(item.uniqueCartId, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <form className="cart-checkout-form" onSubmit={handleCheckout} id="order-checkout-form">
            <div className="cart-summary">
              <span>Grand Total</span>
              <strong style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>
                GHS {(getBasketTotalMinor() / 100).toFixed(2)}
              </strong>
            </div>

            <div className="form-group">
              <label htmlFor="customer-name-input">Your Full Name *</label>
              <input 
                type="text" 
                id="customer-name-input"
                className="form-control" 
                required 
                placeholder="e.g. John Doe"
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer-phone-input">Contact Phone *</label>
              <input 
                type="tel" 
                id="customer-phone-input"
                className="form-control" 
                required 
                placeholder="e.g. 0593800950"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer-note-input">Delivery Address or Shipping Notes</label>
              <textarea 
                id="customer-note-input"
                className="form-control" 
                rows={2} 
                placeholder="e.g. Airport Residential shipping..."
                value={checkoutNote}
                onChange={(e) => setCheckoutNote(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="merchant-phone-input">Merchant WhatsApp Route (Testing)</label>
              <input 
                type="text" 
                id="merchant-phone-input"
                className="form-control" 
                style={{ borderColor: 'rgba(212,175,55,0.4)', background: 'transparent' }}
                value={whatsappMerchantNumber}
                onChange={(e) => setWhatsappMerchantNumber(e.target.value)}
                placeholder="e.g. 233593800950"
              />
            </div>

            <button 
              type="submit" 
              className="btn-gold-solid" 
              style={{ width: '100%', marginTop: '12px' }}
              id="btn-submit-order"
            >
              ⚜ Checkout via WhatsApp ⚜
            </button>
          </form>
        )}
      </div>

      {/* Merchant Admin Dashboard Drawer */}
      <div className={`admin-drawer ${isAdminOpen ? 'active' : ''}`} id="admin-analytics-drawer">
        <div className="admin-header">
          <h3 style={{ fontSize: '1.35rem' }}>⚜ Merchant Portal (likekodji)</h3>
          <button className="modal-close" style={{ position: 'static' }} onClick={() => setIsAdminOpen(false)}>✕</button>
        </div>

        {/* Tab Controls */}
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${adminActiveTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setAdminActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          <button 
            className={`admin-tab ${adminActiveTab === 'logistics' ? 'active' : ''}`}
            onClick={() => setAdminActiveTab('logistics')}
          >
            🚚 Logistics Engine
          </button>
          <button 
            className={`admin-tab ${adminActiveTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setAdminActiveTab('campaigns')}
          >
            📢 Campaigns
          </button>
        </div>

        <div className="admin-content">
          
          {/* TAB 1: Live analytics */}
          {adminActiveTab === 'analytics' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>
                  Live Business Tracker
                </h4>
                <button 
                  onClick={() => setRefreshAnalytics(prev => prev + 1)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-brass)', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  🔄 Refresh Stats
                </button>
              </div>

              {teamAnalytics ? (
                <>
                  <div className="analytics-grid">
                    <div className="analytics-card">
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Orders Created</span>
                      <div className="analytics-value">{teamAnalytics.baskets ? teamAnalytics.baskets.length : 0}</div>
                    </div>
                    <div className="analytics-card">
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Drop Campaigns</span>
                      <div className="analytics-value">{teamAnalytics.campaigns ? teamAnalytics.campaigns.length : 0}</div>
                    </div>
                  </div>

                  <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Baskets Registry
                  </h4>
                  
                  <div className="orders-list">
                    {teamAnalytics.baskets && teamAnalytics.baskets.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                        No orders have been submitted under team slug 'likekodji' yet.
                      </p>
                    ) : (
                      teamAnalytics.baskets && teamAnalytics.baskets.map(ord => (
                        <div key={ord.id} className="order-row">
                          <div>
                            <strong style={{ color: 'var(--color-gold)' }}>Ref: {ord.id}</strong>
                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-secondary)' }}>
                              {new Date(ord.created_at * 1000).toLocaleDateString()}
                            </span>
                          </div>
                          <strong style={{ fontSize: '0.9rem' }}>
                            GHS {(ord.total_minor / 100).toFixed(2)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  Loading team dashboard analytics...
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GSAP-Animated Spatial Courier Logistics Matcher */}
          {adminActiveTab === 'logistics' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>
                  Last-Mile Delivery Dispatch Center
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Matches pending orders with the closest available courier in Accra using spatial coordinates (Haversine formula).
                </p>
              </div>

              {/* Exquisite gold-lined vector map */}
              <div className="logistics-map-container" id="logistics-accra-map">
                <div className="map-grid-bg"></div>
                
                {/* Central Boutique position */}
                <div className="map-boutique-pin" style={{ left: `${BOUTIQUE_X}%`, top: `${BOUTIQUE_Y}%` }}></div>

                {/* Available Couriers positions */}
                {couriers.map(rider => (
                  <div 
                    key={rider.id}
                    id={`courier-${rider.id}`} 
                    className="map-courier-rider" 
                    style={{ left: `${rider.startX}%`, top: `${rider.startY}%` }}
                    data-name={rider.name.split(' ')[0]}
                  ></div>
                ))}

                {/* Neighbor hotpoint pins */}
                {ACCRA_NEIGHBORHOODS.map(nh => (
                  <React.Fragment key={nh.name}>
                    <div 
                      className={`map-destination-pin ${selectedDelivery && dispatchLocationName === nh.name ? 'active' : ''}`}
                      style={{ left: `${nh.x}%`, top: `${nh.y}%` }}
                    ></div>
                    <span 
                      className="map-destination-label"
                      style={{ left: `${nh.x}%`, top: `${nh.y}%` }}
                    >
                      {nh.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Status info bar */}
              {selectedDelivery && (
                <div className="dispatch-stats-row">
                  <div>
                    <strong>Route details to:</strong> {dispatchLocationName} <br />
                    <strong>Optimal Distance:</strong> {dispatchDistance.toFixed(2)} km
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>Ref:</strong> {selectedDelivery.id}
                  </div>
                </div>
              )}

              {dispatchStatusMsg && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: 'rgba(0, 170, 255, 0.05)',
                  borderLeft: '2px solid #00aaff',
                  fontSize: '0.8rem',
                  color: '#00aaff'
                }}>
                  ✦ {dispatchStatusMsg}
                </div>
              )}

              {/* Pending delivery matching table */}
              <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '24px', marginBottom: '12px' }}>
                Pending Delivery Queues
              </h4>

              <div className="orders-list">
                {!teamAnalytics || !teamAnalytics.baskets || teamAnalytics.baskets.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    No orders have been submitted under team slug 'likekodji' to match.
                  </p>
                ) : (
                  teamAnalytics.baskets.map(ord => (
                    <div key={ord.id} className="order-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: 'var(--color-gold)' }}>Ref: {ord.id}</strong>
                          <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-secondary)' }}>
                            Accra Delivery Required
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.9rem' }}>
                          GHS {(ord.total_minor / 100).toFixed(2)}
                        </strong>
                      </div>

                      <button 
                        className="btn-gold" 
                        style={{ padding: '6px 14px', fontSize: '0.75rem', width: '100%' }}
                        disabled={isDispatching}
                        onClick={() => handleAutoDispatch(ord)}
                      >
                        Auto-Dispatch Nearest Courier 🚚
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Campaigns creator form */}
          {adminActiveTab === 'campaigns' && (
            <div className="campaign-form" style={{ marginTop: 0, paddingTop: 0 }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Publish a Lookbook Drop</h3>
              
              <form onSubmit={handleCreateCampaign} id="publish-campaign-form">
                <div className="form-group">
                  <label htmlFor="campaign-title-input">Lookbook Title *</label>
                  <input 
                    type="text" 
                    id="campaign-title-input"
                    className="form-control" 
                    required 
                    placeholder="e.g. Midnight Sartorial Drop"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="campaign-copy-input">Lookbook Description / Copy</label>
                  <textarea 
                    id="campaign-copy-input"
                    className="form-control" 
                    rows={3} 
                    placeholder="Introduce the theme and craft behind this collection..."
                    value={campaignCopy}
                    onChange={(e) => setCampaignCopy(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="campaign-file-input">Lookbook Drop Banner Image</label>
                  <input 
                    type="file" 
                    id="campaign-file-input"
                    className="form-control" 
                    accept="image/*"
                    onChange={(e) => setCampaignImageFile(e.target.files[0])}
                  />
                </div>

                <div className="form-group">
                  <label>Feature Outfits in Drop</label>
                  <div className="multiselect-grid">
                    {catalog.map(prod => (
                      <label key={prod.id} className="multiselect-item">
                        <input 
                          type="checkbox" 
                          checked={campaignFeaturedIds.includes(prod.id)}
                          onChange={() => handleCheckboxChange(prod.id)}
                        />
                        <span>{prod.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-gold-solid" 
                  style={{ width: '100%', marginTop: '16px' }}
                  id="btn-publish-lookbook"
                >
                  Publish New Collection Drop
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Brand Footer */}
      <footer style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-grey)',
        padding: '60px 0 40px',
        textAlign: 'center',
        marginTop: '80px'
      }}>
        <div className="container">
          <img src={logoImg} alt="MENSAH logo" style={{ height: '30px', objectFit: 'contain', opacity: '0.6', marginBottom: '20px' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            MENSAH Luxury Group &copy; 2026 • Tailored with pride in Accra • Team likekodji
          </p>
        </div>
      </footer>
    </>
  );
}
