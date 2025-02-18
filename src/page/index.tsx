import React, {
  Children,
  CSSProperties,
  forwardRef,
  ForwardRefRenderFunction,
  isValidElement,
  ReactElement,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import isValidArray from 'is-valid-array';
import ResizeObserver from 'resize-observer-polyfill';

import { getCurBreakPoint, getMaxNumberOfColumns, isValidGap, wrapUnit } from '@/utils';
import Context from '@/common/context';
import { DEFAULT_BREAK_POINTS } from '@/common/constant';
import useCombinedRefs from '@/hooks/use-combine-ref';
import useGuid from '@/hooks/use-guid';
import PageContent, { PageContentProps } from './content';
import { BaseBgMode, BaseGap, BaseProps, BreakPoint, BreakPoints } from '../types';

interface ContentProps extends BaseBgMode {
  style?: CSSProperties;
  noPadding?: boolean;
}

export interface PageProps extends PageContentProps, BaseBgMode, BaseProps {
  /**
   * class 前缀
   */
  prefix?: string;

  header?: ReactElement;
  footer?: ReactElement;
  nav?: ReactElement;
  aside?: ReactElement;

  // string 指的是 calc(100vh - 52px) 这种，而不是 30px
  minHeight?: number | string;
  /**
   * 禁用页面内边距（包含 Header, Content, Footer）
   */
  noPadding?: boolean;

  contentProps?: ContentProps;

  /**
   * 章之间的间距（若未指定单位，默认为 px)
   */
  sectionGap?: BaseGap;
  /**
   * 水槽间距（若未指定单位，默认为 px)
   */
  blockGap?: BaseGap;
  /**
   * 小布局间距（行、列、网格布局的 单元格-Cell 间距, 若未指定单位，默认为 px）
   */
  gridGap?: BaseGap;

  /**
   * 断点配置
   */
  breakPoints?: BreakPoints;

  children?: ReactNode;

  /**
   * 断点更新时回调
   * @param curBreakPoint
   * @param prevBreakPoint
   * @param breakPoints
   */
  onBreakPointChange?: (
    newBreakPoint: BreakPoint,
    prevBreakPoint?: BreakPoint,
    breakPoints?: BreakPoints,
  ) => void;
}

const Page: ForwardRefRenderFunction<any, PageProps> = (props, ref) => {
  const {
    prefix,
    className,
    style,
    children,
    minHeight,
    mode,
    noPadding,
    contentProps,
    header,
    nav,
    aside,
    footer,
    breakPoints: breakPointsProp,
    sectionGap,
    blockGap,
    gridGap,
    onBreakPointChange,
    ...others
  } = props;

  const pageStyle = useMemo(
    () => ({
      ...style,
      minHeight,
    }),
    [style, minHeight],
  );

  // 保证断点一定是有效数组
  const breakPoints = isValidArray(breakPointsProp) ? breakPointsProp : DEFAULT_BREAK_POINTS;

  const pageRef = useRef(null);
  const combinedRef = useCombinedRefs(ref, pageRef);
  const contentRef = useRef(null);
  const bpRef = useRef(getCurBreakPoint(breakPoints));
  const [curBreakPoint, setBreakPoint] = useState(getCurBreakPoint(breakPoints));
  const guid = useGuid('fd-layout-');

  const pageSizeObsr = new ResizeObserver(() => {
    const newBreakPoint = getCurBreakPoint(breakPoints);

    if (bpRef?.current?.width !== newBreakPoint.width && onBreakPointChange) {
      onBreakPointChange(newBreakPoint, bpRef?.current, breakPoints);
    }

    bpRef.current = newBreakPoint;
    setBreakPoint(newBreakPoint);
  });

  useEffect(() => {
    if (pageRef?.current) {
      pageSizeObsr.observe(pageRef.current);
    }

    // 默认执行一次回调
    if (onBreakPointChange) {
      onBreakPointChange(getCurBreakPoint(breakPoints), undefined, breakPoints);
    }

    return () => {
      if (pageRef.current) {
        pageSizeObsr.unobserve(pageRef.current);
      }
    };
  }, []);

  let headerNode = header;
  let footerNode = footer;
  let navNode = nav;
  let asideNode = aside;
  const contentsNodes: ReactElement[] = [];

  // 非标准节点 如 Section, P 等
  const tmp = Children.map(children, (child) => {
    if (isValidElement(child)) {
      // @ts-ignore
      const tm = child?.type?.typeMark;

      if (tm) {
        if (tm === 'Header') {
          headerNode = child;
        } else if (tm === 'Footer') {
          footerNode = child;
        } else if (tm === 'Aside') {
          asideNode = child;
        } else if (tm === 'Nav') {
          navNode = child;
        } else if (tm === 'Content') {
          contentsNodes.push(child);
        } else {
          return child;
        }

        return null;
      }
    }

    return child;
  });

  const nonStdChildren = Array.isArray(tmp) ? tmp.filter((c) => !!c) : null;

  const pageCls = classNames(className, {
    [`${prefix}page`]: true,
    [`${prefix}page--col-${curBreakPoint.numberOfColumns}`]: true,
    [`${prefix}page--not-tab`]: true,
    [`${prefix}page--headless`]: !headerNode,
    [`${prefix}page--footless`]: !footerNode,
    [`${prefix}page--no-padding`]: noPadding,
    [`${prefix}bg--${mode}`]: !!mode,
  });

  const defaultContent =
    contentsNodes.length > 0 ? (
      contentsNodes
    ) : (
      <PageContent
        // @ts-ignore
        ref={contentRef}
        noPadding={noPadding}
        // @ts-ignore
        {...contentProps}
      >
        {navNode}
        {asideNode}
        {nonStdChildren}
      </PageContent>
    );

  return (
    <>
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
          :host,
           #${guid} {
            --page-max-content-width: ${wrapUnit(
              curBreakPoint.maxContentWidth === Infinity
                ? '100%'
                : wrapUnit(curBreakPoint.maxContentWidth),
            )};
            ${isValidGap(sectionGap) ? `--page-section-gap: ${wrapUnit(sectionGap)};` : ''}
            ${isValidGap(blockGap) ? `--page-block-gap: ${wrapUnit(blockGap)};` : ''}
            ${isValidGap(gridGap) ? `--page-grid-gap: ${wrapUnit(gridGap)};` : ''}
          }`,
        }}
      />
      {/* @ts-ignore */}
      <div id={guid} ref={combinedRef} className={pageCls} style={pageStyle} {...others}>
        <Context.Provider
          value={{
            prefix,
            noPadding,
            sectionGap,
            gridGap,
            blockGap,
            breakPoint: curBreakPoint,
            maxNumberOfColumns: getMaxNumberOfColumns(breakPoints),
          }}
        >
          {headerNode}
          {defaultContent}
          {footerNode}
        </Context.Provider>
      </div>
    </>
  );
};

const RefPage = forwardRef<HTMLDivElement, PageProps>(Page);

RefPage.displayName = 'Page';

RefPage.defaultProps = {
  prefix: 'fd-layout-',
  mode: 'lining',
  breakPoints: DEFAULT_BREAK_POINTS,
};

export default RefPage;
