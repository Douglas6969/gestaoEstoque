import React, { useState, useRef } from 'react';
import { usePopper } from 'react-popper';
import './PopoverMenu.css';

const PopoverMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const subMenuRef = useRef(null);

  const { styles, attributes } = usePopper(buttonRef.current, popoverRef.current, {
    placement: 'bottom-start',
    
  });

  const { styles: subMenuStyles, attributes: subMenuAttributes } = usePopper(popoverRef.current, subMenuRef.current, {
    placement: 'right-start',
   
  });

  // Fecha o sub-menu ao abrir/fechar o menu principal
  const togglePopover = () => {
    setIsOpen(!isOpen);
    setIsSubMenuOpen(false); 
  };

  const toggleSubMenu = () => {
    setIsSubMenuOpen(!isSubMenuOpen);
  };

  return (
    <div className="popover-container">
      <button ref={buttonRef} onClick={togglePopover} className="popover-button">
        Abrir Menu
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="popover-menu"
          style={styles.popper}
          {...attributes.popper}
        >
          <ul>
            <li onClick={toggleSubMenu}>Opção 1</li>
            <li>Opção 2</li>
            <li>Opção 3</li>
          </ul>

          {isSubMenuOpen && (
            <div
              ref={subMenuRef}
              className="popover-submenu"
              style={subMenuStyles.popper}
              {...subMenuAttributes.popper}
            >
              <input type="file" name="Assinatura" id="file" className="popover-file-input" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PopoverMenu;
