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

// Curated luxury product names and captions (overriding generic "Outfit 1" names)
const BESPOKE_PRODUCT_DETAILS = [
  // Agbadas (0 - 2)
  {
    name: "The Emperor's Drape ⚜",
    description: "A majestic ivory white flowing garment adorned with metallic gold geometric hand-embroidery. Formulated with rigid canvas for royal presentation."
  },
  {
    name: "Gilded Heritage Agbada ⚜",
    description: "Rich obsidian black cotton blend featuring structured shoulder padding, elegant side drapes, and high-profile bronze needlework."
  },
  {
    name: "Sovereign Crest Agbada ⚜",
    description: "Royal indigo weave paired with heavy canvas lining, modern tailored collar embroidery, and open-drape flowing comfort."
  },
  // Senators (3 - 5)
  {
    name: "The Diplomat Senator 👔",
    description: "An elegant charcoal grey minimal cut tunic featuring hand-stitched piping and structured shoulders for professional stature."
  },
  {
    name: "Regent Midnight Senator 👔",
    description: "Midnight sapphire blue tunic crafted from thick premium linen, complete with a modern high-profile collar and concealed buttons."
  },
  {
    name: "Envoy Olive Senator 👔",
    description: "Sage olive green minimalist canvas tunic with asymmetrical gold chest embroidery, double lining, and Italian-inspired cuff structure."
  },
  // Sartorial Cuts (6 - 9)
  {
    name: "The Executive Ivory Suit ✂",
    description: "A contemporary cream-white double-breasted jacket paired with sleek tailored trousers. Crafted with breathable premium Savile-inspired linen."
  },
  {
    name: "Monarch Navy Blazer ✂",
    description: "Deep navy blue double-breasted canvas blazer featuring textured gold buttons, structured padded shoulders, and tapered trousers."
  },
  {
    name: "Sterling Charcoal Suit ✂",
    description: "High-contrast charcoal check blazer constructed with a soft silk lapel, rigid canvas build, and organic Accra-woven cotton."
  },
  {
    name: "Obsidian Sovereign Suit ✂",
    description: "All-black tailored formalwear showcasing structured shoulders, custom gold monogram lining, and deep obsidian high-twist linen."
  }
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
  // App view router: 'landing' (story & curated showcase) or 'store' (transactional mall)
  const [view, setView] = useState('landing');

  // Data lists
  const [catalog, setCatalog] = useState([]);
  const [filteredCatalog, setFilteredCatalog] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenCampaignIds, setHiddenCampaignIds] = useState(() => {
    try {
      const saved = localStorage.getItem('mensah_hidden_campaigns');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Helper to hide lookbook drops client-side (API is create-only)
  const hideCampaign = (campaignId) => {
    const updated = [...hiddenCampaignIds, campaignId];
    setHiddenCampaignIds(updated);
    try {
      localStorage.setItem('mensah_hidden_campaigns', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    triggerToast('Lookbook drop removed from display.');
  };

  // Curated Collection Category switching states
  const [activeCategory, setActiveCategory] = useState('all'); // all, agbada, senator, sartorial

  // Cart & Checkout (Store page only)
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('0593800950');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [whatsappMerchantNumber, setWhatsappMerchantNumber] = useState(DEFAULT_WHATSAPP_NUMBER);

  // Confirmed Basket state to show order receipt details
  const [confirmedBasket, setConfirmedBasket] = useState(null);

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
  const [chatStep, setChatStep] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [tempMetrics, setTempMetrics] = useState({ chest: null, waist: null, hips: null });
  const [chatbotFitScore, setChatbotFitScore] = useState(null);
  const [chatbotSizeLabel, setChatbotSizeLabel] = useState(null);
  const [fitPreference, setFitPreference] = useState('tailored');

  // Ref for chatbot scroll pinning
  const chatScrollRef = useRef(null);

  // -------------------------------------------------------------
  // Logistics Engine & Map Dashboard States (Store page only)
  // -------------------------------------------------------------
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState('analytics');
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [refreshAnalytics, setRefreshAnalytics] = useState(0);

  // Map Courier Dispatch states
  const [couriers, setCouriers] = useState(COURIERS_LIST);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState('');
  const [dispatchDistance, setDispatchDistance] = useState(0);
  const [dispatchLocationName, setDispatchLocationName] = useState('');

  // New Campaign Form
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignCopy, setCampaignCopy] = useState('');
  const [campaignImageFile, setCampaignImageFile] = useState(null);
  const [campaignFeaturedIds, setCampaignFeaturedIds] = useState([]);

  // Luxury Private Consultation Booking states
  const [consultationEmail, setConsultationEmail] = useState('');
  const [consultationName, setConsultationName] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

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
    async function loadData() {
      try {
        setLoading(true);
        const [catalogData, campaignsData] = await Promise.all([
          fetchCatalog(),
          fetchCampaigns()
        ]);

        // Enrich catalog items with curated category tags & lucrative details
        const enrichedCatalog = catalogData.map((item, idx) => {
          let category = 'sartorial'; // Fallback category
          if (idx < 3) category = 'agbada';
          else if (idx < 6) category = 'senator';

          const bespoke = BESPOKE_PRODUCT_DETAILS[idx] || {};
          return {
            ...item,
            category,
            name: bespoke.name || item.name,
            description: bespoke.description || item.description
          };
        });

        setCatalog(enrichedCatalog);
        setFilteredCatalog(enrichedCatalog);
        setCampaigns(campaignsData);
      } catch (err) {
        console.error(err);
        setError('Atelier connection active. Restoring default visual drops.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
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

  // 4. GSAP Cinematic Entrance Animations on load
  useEffect(() => {
    if (!loading) {
      const tl = gsap.timeline();

      tl.fromTo('.hero-subtitle',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      )
        .fromTo('.hero-title',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
          '-=0.5'
        )
        .fromTo('.hero-desc',
          { opacity: 0 },
          { opacity: 1, duration: 1.2 },
          '-=0.6'
        )
        .fromTo('.hero-actions',
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.75)' },
          '-=0.4'
        );

      // Stagger reveal entrance for product cards
      gsap.fromTo('.product-card',
        { opacity: 0, y: 50, rotate: 1 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power2.out'
        }
      );
    }
  }, [loading, view]);

  // 5. GSAP Page Router View Switch Transition
  const switchAppView = (targetView) => {
    if (targetView === view) return;

    // Smooth page fade-out
    gsap.to('main', {
      opacity: 0,
      y: -20,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        // Reset category filters & change view state
        if (targetView === 'store') {
          setActiveCategory('agbada');
          setFilteredCatalog(catalog.filter(item => item.category === 'agbada'));
        } else {
          setActiveCategory('all');
          setFilteredCatalog(catalog);
        }
        setView(targetView);
        window.scrollTo(0, 0);

        // Smooth page fade-in
        setTimeout(() => {
          gsap.fromTo('main',
            { opacity: 0, y: 25 },
            { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
          );
        }, 50);
      }
    });
  };

  // 6. GSAP Collection Category Switcher Transition Timeline
  const filterCollection = (category) => {
    if (category === activeCategory) return;

    gsap.to('.product-card', {
      opacity: 0,
      y: -25,
      scale: 0.97,
      rotate: -1,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.in',
      onComplete: () => {
        if (category === 'all') {
          setFilteredCatalog(catalog);
        } else {
          setFilteredCatalog(catalog.filter(item => item.category === category));
        }
        setActiveCategory(category);

        setTimeout(() => {
          gsap.fromTo('.product-card',
            { opacity: 0, y: 35, scale: 0.97, rotate: 1 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              rotate: 0,
              duration: 0.6,
              stagger: 0.08,
              ease: 'power3.out'
            }
          );
        }, 50);
      }
    });
  };

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

    const userMsgId = Date.now();
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);

    setTimeout(() => {
      gsap.fromTo(`#msg-${userMsgId}`,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }, 50);

    if (chatStep === 1) {
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

  const calculateChatbotFitting = (metrics) => {
    setTimeout(() => {
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
    const chatSummary = `Calculated Sizing: ${chatbotSizeLabel}. (Chest: ${tempMetrics.chest}cm, Waist: ${tempMetrics.waist}cm, Hips: ${tempMetrics.hips}cm). Match: ${chatbotFitScore}.`;
    setTailoringNote(chatSummary);
    setIsFittingRoomActive(false);
    triggerToast('Fitting coordinates applied successfully!');
  };

  // -------------------------------------------------------------
  // GSAP-Animated Spatial Courier Logistics Matcher (Admin)
  // -------------------------------------------------------------
  const handleAutoDispatch = (deliveryBasket) => {
    if (isDispatching) return;
    setSelectedDelivery(deliveryBasket);
    setIsDispatching(true);

    const destNeighborhood = ACCRA_NEIGHBORHOODS[Math.floor(Math.random() * ACCRA_NEIGHBORHOODS.length)];
    setDispatchLocationName(destNeighborhood.name);
    setDispatchStatusMsg('Initiating Haversine spatial proximity analysis...');

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

    setTimeout(() => {
      setDispatchStatusMsg(`Spatial match: ${closestCourier.name} is closest (${minDistance.toFixed(2)} km away). Dispatching rider to Boutique...`);

      const tl = gsap.timeline({
        onComplete: () => {
          setDispatchStatusMsg('Package picked up at Mensah Boutique. Easing delivery route to customer...');

          gsap.to(`#courier-${closestCourier.id}`, {
            left: `${destNeighborhood.x}%`,
            top: `${destNeighborhood.y}%`,
            duration: 3.5,
            ease: 'sine.inOut',
            onComplete: () => {
              setDispatchStatusMsg(`Order ${deliveryBasket.id} delivered successfully to ${destNeighborhood.name}!`);
              setIsDispatching(false);
              triggerToast(`Delivery confirmed to ${destNeighborhood.name}!`);

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

      tl.to(`#courier-${closestCourier.id}`, {
        left: `${BOUTIQUE_X}%`,
        top: `${BOUTIQUE_Y}%`,
        duration: 2.2,
        ease: 'power1.inOut'
      });

    }, 1200);
  };

  // -------------------------------------------------------------
  // Standard E-Commerce Actions (Store page only)
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

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    try {
      triggerToast('Registering bespoke order with API server...');

      const basketPayload = {
        items: cart,
        customerName: checkoutName,
        customerPhone: checkoutPhone,
        customerNote: checkoutNote
      };

      const result = await submitBasket(basketPayload);
      const basketId = result.id;

      triggerToast('Bespoke order registered successfully!');

      const totalCedis = (getBasketTotalMinor() / 100).toFixed(2);
      const itemsSummary = cart.map(item => {
        let line = `- ${item.qty}x ${item.name} (Bespoke Commission)`;
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
*View Details Online:*
${formatImageUrl(`/baskets/${basketId}`)}
----------------------------------
_Thank you for choosing sartorial excellence._`;

      const encodedMsg = encodeURIComponent(whatsappText);
      const targetPhone = whatsappMerchantNumber.replace(/[^0-9+]/g, '');
      const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodedMsg}`;

      // Save details to render a gorgeous pop-up safe receipt modal
      setConfirmedBasket({
        id: basketId,
        name: checkoutName,
        total: totalCedis,
        items: [...cart],
        url: whatsappUrl
      });

      // Clear the local cart and close the cart drawer
      setCart([]);
      setIsCartOpen(false);

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

  const handleCheckboxChange = (itemId) => {
    setCampaignFeaturedIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleConsultationSubmit = (e) => {
    e.preventDefault();
    if (!consultationEmail) return;
    setSignupSuccess(true);
    triggerToast('Private consultation requested. Our head tailor will coordinate soon.');
    setTimeout(() => {
      setSignupSuccess(false);
      setConsultationName('');
      setConsultationEmail('');
    }, 4000);
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
          <div className="logo-wrapper" onClick={() => switchAppView('landing')}>
            <img src={logoImg} alt="MENSAH logo" className="logo-img" />
          </div>

          <div className="nav-actions">
            {view === 'landing' ? (
              <>
                <button
                  className="btn-gold"
                  onClick={() => {
                    document.getElementById('brand-story').scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  The Story
                </button>
                <button
                  className="btn-gold"
                  onClick={() => {
                    document.getElementById('inventory-catalog').scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Spotlight
                </button>
                <button
                  className="btn-gold-solid"
                  onClick={() => switchAppView('store')}
                >
                  ⚜ Enter Shopping Mall ⚜
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-gold"
                  onClick={() => switchAppView('landing')}
                >
                  Atelier Home ⚜
                </button>
                <button
                  className="btn-gold"
                  id="btn-admin-drawer"
                  onClick={() => setIsAdminOpen(true)}
                >
                  ⚜ Portal Admin
                </button>
                <button
                  className="btn-gold-solid"
                  id="btn-cart-drawer"
                  onClick={() => setIsCartOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>🛒 Basket</span>
                  {cart.length > 0 && (
                    <span style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--color-gold)',
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '50%',
                      fontWeight: '700'
                    }}>
                      {cart.reduce((s, i) => s + i.qty, 0)}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* VIEW 1: BRAND LANDING PAGE (NO PRICES) */}
      {view === 'landing' && (
        <main>
          {/* Hero Showcase Section */}
          <section className="hero-showcase" style={{ padding: '140px 0 100px' }}>
            <div className="container">
              <span className="hero-subtitle">✦ Savile Row Structure meets West African Heritage ✦</span>
              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Sartorial Dignity. <br />
                <span style={{ color: 'var(--color-gold)' }}>Bespoke Craftsmanship.</span>
              </h1>
              <p className="hero-desc" style={{ fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto 40px' }}>
                We do not just construct garments; we shape presence. Mensah creates premium structured suits and modernized traditional West African formalwear with geometric detailing.
              </p>
              <div className="hero-actions" style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button
                  className="btn-gold-solid"
                  onClick={() => switchAppView('store')}
                >
                  ⚜ Enter Shopping Mall ⚜
                </button>
                <button
                  className="btn-gold"
                  onClick={() => {
                    document.getElementById('brand-story').scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Discover Story
                </button>
              </div>
            </div>
          </section>

          {/* The Craft & Story Narrative Section */}
          <section className="lookbook-section" id="brand-story" style={{ background: '#0a0a0a' }}>
            <div className="container">
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '60px', alignItems: 'center' }}>
                <div>
                  <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    ✦ The Atelier Philosophy ✦
                  </span>
                  <h2 style={{ fontSize: '2.5rem', marginTop: '12px', marginBottom: '24px', fontFamily: 'var(--font-serif)' }}>
                    Where architecture meets organic textiles.
                  </h2>
                  <p style={{ marginBottom: '16px', fontSize: '0.98rem' }}>
                    Every Mensah garment begins with a rigid canvas and natural fibers, hand-woven and embroidered locally. We pay homage to traditional agbadas and kaftans by refining their draping silhouettes with modern Italian shoulder structures and high-profile collars.
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '28px' }}>
                    Each outfit from our seasonal collections is meticulously calculated to fit perfectly. Click **"Bespoke Details"** below to preview premium fabrics, silhouette shapes, and close-ups, or navigate to our digital **Shopping Mall** to configure custom measurements.
                  </p>

                  <div style={{ display: 'flex', gap: '40px' }}>
                    <div>
                      <h4 style={{ color: 'var(--color-gold)', fontSize: '1.8rem', fontFamily: 'var(--font-serif)' }}>100%</h4>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Bespoke Linen & Cotton</span>
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--color-gold)', fontSize: '1.8rem', fontFamily: 'var(--font-serif)' }}>Accra</h4>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Handcrafted Locally</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(212, 175, 55, 0.03)',
                  border: '1px solid var(--border-gold)',
                  padding: '40px',
                  borderRadius: '4px',
                  position: 'relative'
                }}>
                  <span style={{ fontStyle: 'italic', fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', display: 'block', marginBottom: '16px' }}>
                    "We believe that a man's posture is his true heritage. The garment must only elevate what is already dignified."
                  </span>
                  <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                    — Kwaku Mensah, Creative Director
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Curated Spotlight Gallery (NO PRICES) */}
          <section className="container" id="inventory-catalog" style={{ padding: '100px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                ✦ Curated Collection Spotlight ✦
              </span>
              <h2 style={{ fontSize: '2.8rem', marginTop: '10px', fontFamily: 'var(--font-serif)' }}>The Sartorial Spotlight</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '550px', margin: '14px auto 0', fontSize: '0.95rem' }}>
                A curated showcase of our preloaded luxury outfits. Explore our heritage designs to preview premium fabrics, silhouette shapes, and closeups.
              </p>
            </div>

            {/* Curated Collection Switcher (GSAP Animated) */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '48px',
              borderBottom: '1px solid var(--border-grey)',
              paddingBottom: '16px'
            }}>
              <button
                className={`admin-tab ${activeCategory === 'all' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('all')}
              >
                All Outfits
              </button>
              <button
                className={`admin-tab ${activeCategory === 'agbada' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('agbada')}
              >
                The Grand Agbadas ⚜
              </button>
              <button
                className={`admin-tab ${activeCategory === 'senator' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('senator')}
              >
                The Senators 👔
              </button>
              <button
                className={`admin-tab ${activeCategory === 'sartorial' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('sartorial')}
              >
                Sartorial Cuts ✂
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <span style={{ color: 'var(--color-gold)', fontSize: '1.25rem' }}>✦ Restoring Atelier Lookbooks...</span>
              </div>
            ) : (
              <div className="products-grid" style={{ gap: '40px' }}>
                {filteredCatalog.map(prod => (
                  <div key={prod.id} className="product-card" id={`spotlight-${prod.id}`}>
                    <div className="product-image-container">
                      <img
                        src={prod.image_urls && prod.image_urls.length > 0 ? formatImageUrl(prod.image_urls[0]) : logoImg}
                        alt={prod.name}
                        className="product-image"
                      />
                      <span className="product-badge" style={{ textTransform: 'uppercase', fontSize: '0.55rem' }}>
                        ✦ {prod.category === 'agbada' ? 'agbada collection' : prod.category === 'senator' ? 'senator tunic' : 'sartorial cut'}
                      </span>
                    </div>
                    <div className="product-info" style={{ padding: '24px 20px' }}>
                      <h3 className="product-name" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>{prod.name}</h3>
                      <p className="product-desc" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {prod.description || 'Premium bespoke cut using heavy senator canvas, fine needlework, and double lining.'}
                      </p>
                      <div className="product-price-row" style={{ marginTop: '16px' }}>
                        <span className="product-price" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)' }}>Bespoke Commission</span>
                        <button
                          className="btn-gold"
                          onClick={() => setSelectedProduct(prod)} // Opens Quick Look preview
                        >
                          Bespoke Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sizing Preview Details Overlay (Landing View version - Lifted to Root Sibling) */}

          {/* Private Consultation & Location Section */}
          <section className="lookbook-section" id="tailor-booking" style={{ background: '#080808' }}>
            <div className="container" style={{ maxWidth: '1100px' }}>
              <div className="atelier-split-grid">
                
                {/* Left Column: Schedule a Fitting */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-grey)',
                  padding: '40px',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>
                    ✦ Private Atelier Session ✦
                  </span>
                  <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', fontFamily: 'var(--font-serif)', color: '#f5f5f0' }}>
                    Schedule a Fitting
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '28px' }}>
                    Connect with our master tailor to arrange a private measurement consult. Enter your credentials below and request booking.
                  </p>

                  <form onSubmit={handleConsultationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <label htmlFor="client-name">Your Full Name</label>
                      <input
                        type="text"
                        id="client-name"
                        className="form-control"
                        required
                        placeholder="e.g. Kwame Mensah"
                        value={consultationName}
                        onChange={(e) => setConsultationName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <label htmlFor="client-email">Email Coordinate</label>
                      <input
                        type="email"
                        id="client-email"
                        className="form-control"
                        required
                        placeholder="e.g. kwame@domain.com"
                        value={consultationEmail}
                        onChange={(e) => setConsultationEmail(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-gold-solid"
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Request Atelier Booking ⚜
                    </button>
                  </form>
                </div>

                {/* Right Column: MENSAH Luxury Atelier Location Card */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-gold)',
                  padding: '40px',
                  borderRadius: '4px',
                  boxShadow: 'var(--shadow-luxury)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>
                      ✦ ATELIER LOCATION ✦
                    </span>
                    <h2 style={{ fontSize: '2.2rem', marginBottom: '12px', fontFamily: 'var(--font-serif)', color: '#f5f5f0' }}>
                      MENSAH Luxury Atelier
                    </h2>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: '500', marginBottom: '8px' }}>
                      East Legon, behind American House, Accra, Ghana
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '24px' }}>
                      Please call <strong style={{ color: 'var(--color-gold)' }}>Godwin on 0593800950</strong> if you have questions or need assistance.
                    </p>
                  </div>

                  {/* Dark Mode Map with Open in Maps button */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '240px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-grey)'
                  }}>
                    <a
                      href="https://www.google.com/maps/search/East+Legon,+behind+American+House,+Accra,+Ghana"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold"
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        zIndex: 10,
                        padding: '6px 14px',
                        fontSize: '0.7rem',
                        background: 'rgba(8, 8, 8, 0.95)',
                        backdropFilter: 'blur(4px)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                      }}
                    >
                      <span>Open in Maps</span>
                      <span style={{ fontSize: '0.8rem' }}>↗</span>
                    </a>

                    <iframe
                      title="MENSAH Luxury Atelier location map"
                      src="https://maps.google.com/maps?q=East+Legon,+Accra,+Ghana&t=&z=15&ie=UTF8&iwloc=&output=embed"
                      width="100%"
                      height="100%"
                      style={{
                        border: 0,
                        filter: 'grayscale(1) invert(0.92) contrast(1.1) brightness(0.95)'
                      }}
                      allowFullScreen=""
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </main>
      )}

      {/* VIEW 2: TRANSACTIONAL SHOPPING MALL PAGE (SHOWS GHS PRICES) */}
      {view === 'store' && (
        <main>
          {/* Mall Welcome Banner */}
          <section className="hero-showcase" style={{ padding: '120px 0 70px' }}>
            <div className="container">
              <span className="hero-subtitle">✦ Live E-Commerce Portal ✦</span>
              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem' }}>The Mensah Shopping Mall</h1>
              <p className="hero-desc" style={{ fontSize: '1rem', maxWidth: '600px', margin: '0 auto 20px' }}>
                Welcome to our interactive digital store. Click **"Bespoke Order"** on any design to configure monograms, activate our AI Fitting chatbot, and check out via WhatsApp.
              </p>
              <button
                className="btn-gold"
                onClick={() => switchAppView('landing')}
              >
                ← Back to Atelier Story
              </button>
            </div>
          </section>

          {/* Active Campaigns Lookbook section */}
          {campaigns.filter(camp => !hiddenCampaignIds.includes(camp.id)).length > 0 && (
            <section className="lookbook-section" id="lookbook-drops">
              <div className="container">
                <h2 className="lookbook-title">Curated Lookbooks</h2>
                <p className="lookbook-subtitle">
                  Click on featured garments featured directly inside active lookbook drops to initiate bespoke tailored orders.
                </p>

                <div className="lookbook-carousel" id="lookbooks-scroll">
                  {campaigns.filter(camp => !hiddenCampaignIds.includes(camp.id)).map(camp => (
                    <div key={camp.id} className="lookbook-slide" id={`campaign-${camp.id}`} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="lookbook-delete-btn"
                        onClick={() => hideCampaign(camp.id)}
                        title="Hide Lookbook Drop"
                      >
                        ✕
                      </button>
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

          {/* Store Interactive Inventory Grid (WITH ACTUAL PRICES) */}
          <section className="container" id="inventory-catalog" style={{ padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                ✦ Sartorial Mall Items ✦
              </span>
              <h2 style={{ fontSize: '2.5rem', marginTop: '10px', fontFamily: 'var(--font-serif)' }}>Atelier Collections</h2>
            </div>

            {/* Collection Swapping controls */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '48px',
              borderBottom: '1px solid var(--border-grey)',
              paddingBottom: '16px'
            }}>
              <button
                className={`admin-tab ${activeCategory === 'agbada' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('agbada')}
              >
                The Grand Agbadas ⚜
              </button>
              <button
                className={`admin-tab ${activeCategory === 'senator' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('senator')}
              >
                The Senators 👔
              </button>
              <button
                className={`admin-tab ${activeCategory === 'sartorial' ? 'active' : ''}`}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                onClick={() => filterCollection('sartorial')}
              >
                Sartorial Cuts ✂
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <span style={{ color: 'var(--color-gold)', fontSize: '1.25rem' }}>✦ Restoring Inventory Files...</span>
              </div>
            ) : (
              <div className="products-grid" style={{ gap: '40px' }}>
                {filteredCatalog.map(prod => (
                  <div key={prod.id} className="product-card" id={`spotlight-${prod.id}`}>
                    <div className="product-image-container">
                      <img
                        src={prod.image_urls && prod.image_urls.length > 0 ? formatImageUrl(prod.image_urls[0]) : logoImg}
                        alt={prod.name}
                        className="product-image"
                      />
                      <span className="product-badge" style={{ textTransform: 'uppercase', fontSize: '0.55rem' }}>
                        ✦ {prod.category === 'agbada' ? 'agbada collection' : prod.category === 'senator' ? 'senator tunic' : 'sartorial cut'}
                      </span>
                    </div>
                    <div className="product-info" style={{ padding: '24px 20px' }}>
                      <h3 className="product-name" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>{prod.name}</h3>
                      <p className="product-desc" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {prod.description || 'Premium bespoke cut using heavy senator canvas, fine needlework, and double lining.'}
                      </p>
                      <div className="product-price-row" style={{ marginTop: '16px' }}>
                        {/* ACTUAL GHS PRICING SHOWN IN TRANSATIONAL MALL VIEW */}
                        <span className="product-price" style={{ fontSize: '1.15rem' }}>
                          GHS {(prod.price_minor / 100).toFixed(2)}
                        </span>
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
      )}

      {/* Sizing Preview Details Overlay (Landing View version - Lifted to Root Sibling) */}
      {view === 'landing' && selectedProduct && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <button className="modal-close" onClick={closePersonalization}>✕</button>
            <div className="modal-grid">
              <div className="modal-image-panel">
                <img
                  src={selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? formatImageUrl(selectedProduct.image_urls[0]) : logoImg}
                  alt={selectedProduct.name}
                />
              </div>
              <div className="modal-details-panel" style={{ justifyContent: 'center' }}>
                <span style={{ color: 'var(--color-gold)', letterSpacing: '0.1em', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  Atelier Close-Up
                </span>
                <h2 style={{ fontSize: '2rem', marginTop: '4px', marginBottom: '16px' }}>{selectedProduct.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '20px' }}>
                  {selectedProduct.description || 'Constructed with double chest lining, a rigid premium shoulder build, and lightweight breathable West African weave.'}
                </p>
                <div style={{
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-grey)',
                  borderRadius: '2px',
                  marginBottom: '24px'
                }}>
                  <strong style={{ color: 'var(--color-gold)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                    📐 Bespoke Sizing Profile
                  </strong>
                  <span style={{ fontSize: '0.85rem' }}>
                    To calculate your exact size coordinates, configure initials monograms, and submit WhatsApp order checkouts, please enter our **Shopping Mall**.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    className="btn-gold-solid"
                    style={{ flexGrow: 1 }}
                    onClick={() => {
                      closePersonalization();
                      switchAppView('store');
                    }}
                  >
                    Enter Shopping Mall ⚜
                  </button>
                  <button
                    className="btn-gold"
                    onClick={closePersonalization}
                  >
                    Close Showcase
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sizing & Tailoring Personalization Modal (Store view version - Lifted to Root Sibling) */}
      {view === 'store' && selectedProduct && (
        <div className="modal-overlay active" id="tailor-modal-overlay">
          <div className="modal-content" style={{ maxWidth: isFittingRoomActive ? '900px' : '850px' }}>
            <button className="modal-close" onClick={closePersonalization}>✕</button>

            <div className="modal-grid" style={{ gridTemplateColumns: isFittingRoomActive ? '1fr 1.2fr' : '1.1fr 1.3fr' }}>
              <div className="modal-image-panel" style={{ display: isFittingRoomActive ? 'none' : 'block' }}>
                <img
                  src={selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? formatImageUrl(selectedProduct.image_urls[0]) : logoImg}
                  alt={selectedProduct.name}
                />
              </div>

              {/* Chatbot Fitting Room Panel */}
              {isFittingRoomActive && (
                <div style={{ padding: '32px', borderRight: '1px solid var(--border-grey)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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

                    <div style={{ padding: '0 12px', background: '#111' }}>
                      {tempMetrics.chest && <span className="fitting-metric-badge">Chest: {tempMetrics.chest}cm</span>}
                      {tempMetrics.waist && <span className="fitting-metric-badge">Waist: {tempMetrics.waist}cm</span>}
                      {tempMetrics.hips && <span className="fitting-metric-badge">Hips: {tempMetrics.hips}cm</span>}
                    </div>

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
                      ✦ Apply Sizing coordinates
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

      {/* Slide-out Cart Drawer - Lifted to Root Sibling */}
      {view === 'store' && (
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
      )}

      {/* Merchant Admin Dashboard Drawer - Lifted to Root Sibling */}
      {view === 'store' && (
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
                              Bespoke Order
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

                  {/* Boutique central position */}
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
                            Bespoke Order
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

                {/* Active campaigns list manager in Admin panel */}
                <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-grey)', paddingTop: '24px' }}>
                  <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--color-gold)', marginBottom: '16px', letterSpacing: '0.1em' }}>
                    Active Lookbooks Management
                  </h4>
                  <div className="orders-list">
                    {campaigns.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No campaigns available.</p>
                    ) : (
                      campaigns.map(camp => {
                        const isHidden = hiddenCampaignIds.includes(camp.id);
                        return (
                          <div key={camp.id} className="order-row" style={{ opacity: isHidden ? 0.45 : 1 }}>
                            <div style={{ flexGrow: 1, marginRight: '16px' }}>
                              <strong style={{ display: 'block', fontSize: '0.9rem', color: isHidden ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                {camp.title}
                              </strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ID: {camp.id} {isHidden && ' • HIDDEN'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn-gold"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.75rem', 
                                borderColor: isHidden ? 'var(--color-gold)' : '#ff6b6b', 
                                color: isHidden ? 'var(--color-gold)' : '#ff6b6b' 
                              }}
                              onClick={() => {
                                if (isHidden) {
                                  const updated = hiddenCampaignIds.filter(id => id !== camp.id);
                                  setHiddenCampaignIds(updated);
                                  try {
                                    localStorage.setItem('mensah_hidden_campaigns', JSON.stringify(updated));
                                  } catch (e) {
                                    console.error(e);
                                  }
                                  triggerToast('Lookbook drop restored to display.');
                                } else {
                                  hideCampaign(camp.id);
                                }
                              }}
                            >
                              {isHidden ? 'Restore' : 'Hide Drop'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}


      {/* Bespoke Order Confirmed Receipt Modal (Pop-up safe checkout routing) */}
      {confirmedBasket && (
        <div className="modal-overlay active" style={{ zIndex: 300 }}>
          <div className="modal-content" style={{ maxWidth: '550px', textAlign: 'center', padding: '40px' }}>
            <button className="modal-close" onClick={() => setConfirmedBasket(null)}>✕</button>

            <div style={{ marginBottom: '24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '1px solid var(--color-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: 'var(--color-gold)',
                fontSize: '2rem'
              }}>
                ✦
              </div>
              <span style={{ color: 'var(--color-gold)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '600' }}>
                Order Registered
              </span>
              <h2 style={{ fontSize: '2.2rem', marginTop: '6px', fontFamily: 'var(--font-serif)' }}>Sartorial Receipt</h2>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-grey)',
              padding: '24px',
              borderRadius: '2px',
              textAlign: 'left',
              marginBottom: '28px',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order Reference:</span>
                <strong style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-sans)' }}>{confirmedBasket.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Client Name:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{confirmedBasket.name || 'Valued Client'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bespoke Value:</span>
                <strong style={{ color: 'var(--color-gold)', fontSize: '1.1rem' }}>GHS {confirmedBasket.total}</strong>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-grey)' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Configured Outfits:
                </span>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {confirmedBasket.items.map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>✦ {item.qty}x {item.name}</span>
                      {item.note && <span style={{ color: 'var(--color-brass)', fontStyle: 'italic', fontSize: '0.75rem' }}>Tailored</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Your garment measurements and monogram config have been securely bound on our Coded Matrix backend under team **likekodji**. Click below to launch your WhatsApp tailor confirmation chat.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href={confirmedBasket.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-solid"
                style={{ textDecoration: 'none', display: 'block', padding: '14px' }}
                onClick={() => setConfirmedBasket(null)}
              >
                ⚜ Launch WhatsApp Tailor Chat ⚜
              </a>
              <button
                className="btn-gold"
                onClick={() => setConfirmedBasket(null)}
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Brand Footer */}
      <footer style={{
        background: '#040404',
        borderTop: '1px solid var(--border-grey)',
        padding: '60px 0 40px',
        textAlign: 'center'
      }}>
        <div className="container">
          <img src={logoImg} alt="MENSAH logo" style={{ height: '30px', objectFit: 'contain', opacity: '0.6', marginBottom: '16px' }} />
          
          {/* Centered Luxury Social Media Links Row */}
          <div className="footer-social-row">
            <a href="https://wa.me/233593800950" target="_blank" rel="noopener noreferrer" className="footer-social-link" title="Contact WhatsApp">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.69-4.98c-.202-.101-1.192-.588-1.37-.653-.18-.066-.31-.097-.442.097-.133.197-.513.653-.629.787-.117.133-.232.148-.43.05-1.979-.99-2.637-1.87-3.098-2.666-.118-.203-.012-.313.088-.413.09-.09.202-.232.302-.349.1-.116.133-.197.2-.33.067-.133.034-.251-.017-.353-.05-.101-.442-1.063-.607-1.46-.159-.387-.318-.335-.442-.34-.117-.005-.251-.006-.384-.006-.133 0-.352.05-.536.25-.184.2-.705.69-.705 1.686 0 .996.723 1.96.824 2.096.1.137 1.42 2.17 3.44 3.045.482.208.857.332 1.151.426.485.154.927.132 1.277.08.39-.058 1.192-.488 1.36-.957.17-.468.17-.87.118-.957-.05-.086-.18-.133-.38-.235z"/>
              </svg>
            </a>
            <a href="https://instagram.com/mensah_luxury" target="_blank" rel="noopener noreferrer" className="footer-social-link" title="Follow Instagram">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.999 0h.002zm-.008 1.528c2.146 0 2.4.008 3.248.046.78.035 1.203.166 1.485.276.374.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.847.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.838.038-1.07.047-3.224.047s-2.39-.008-3.232-.047c-.78-.035-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
              </svg>
            </a>
            <a href="https://x.com/mensah_lux" target="_blank" rel="noopener noreferrer" className="footer-social-link" title="Follow X (Twitter)">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/mensah-luxury" target="_blank" rel="noopener noreferrer" className="footer-social-link" title="Follow LinkedIn">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
              </svg>
            </a>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            MENSAH Luxury Group &copy; 2026 • Tailored with pride in Accra • Team likekodji
          </p>
        </div>
      </footer>
    </>
  );
}
